import { serverEnv } from "./config";
import { sql } from "./db";

export type SyncProvider = "hubspot" | "apollo" | "notion" | "gohighlevel";

type SyncOptions = {
  organizationId: string;
  provider: SyncProvider;
  limit: number;
};

type NormalizedContact = {
  provider: SyncProvider;
  externalId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  companyName: string | null;
  companyDomain: string | null;
  sourcePayload: Record<string, unknown>;
};

type ProviderPullResult = {
  contacts: NormalizedContact[];
  sourceCount: number;
};

export type SyncResult = {
  provider: SyncProvider;
  sourceCount: number;
  importedContacts: number;
  importedCompanies: number;
  skipped: number;
  errors: string[];
};

const providerLabels: Record<SyncProvider, string> = {
  hubspot: "HubSpot",
  apollo: "Apollo",
  notion: "Notion",
  gohighlevel: "GoHighLevel",
};

export function isSyncProvider(provider: string): provider is SyncProvider {
  return ["hubspot", "apollo", "notion", "gohighlevel"].includes(provider);
}

export async function syncIntegrationContacts({ organizationId, provider, limit }: SyncOptions): Promise<SyncResult> {
  const normalizedLimit = Math.max(1, Math.min(limit, 100));
  const result = await pullProviderContacts(provider, normalizedLimit);
  let importedContacts = 0;
  let importedCompanies = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const contact of result.contacts) {
    try {
      if (!contact.email && !contact.phone) {
        skipped += 1;
        continue;
      }

      const companyId = contact.companyName || contact.companyDomain
        ? await upsertCompany(organizationId, contact)
        : null;
      if (companyId) {
        importedCompanies += 1;
      }

      const contactId = await upsertContact(organizationId, companyId, contact);
      await sql()`
        insert into integration_external_records (
          organization_id, provider, external_id, record_type, crm_company_id, crm_contact_id, source_payload, last_seen_at
        ) values (
          ${organizationId}, ${contact.provider}, ${contact.externalId}, 'contact', ${companyId}, ${contactId}, ${JSON.stringify(contact.sourcePayload)}, now()
        )
        on conflict (organization_id, provider, external_id, record_type) do update set
          crm_company_id = excluded.crm_company_id,
          crm_contact_id = excluded.crm_contact_id,
          source_payload = excluded.source_payload,
          last_seen_at = now()
      `;
      importedContacts += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown contact import error");
    }
  }

  return {
    provider,
    sourceCount: result.sourceCount,
    importedContacts,
    importedCompanies,
    skipped,
    errors,
  };
}

async function pullProviderContacts(provider: SyncProvider, limit: number): Promise<ProviderPullResult> {
  if (provider === "hubspot") {
    return pullHubSpotContacts(limit);
  }
  if (provider === "apollo") {
    return pullApolloContacts(limit);
  }
  if (provider === "notion") {
    return pullNotionContacts(limit);
  }
  return pullGoHighLevelContacts(limit);
}

async function pullHubSpotContacts(limit: number): Promise<ProviderPullResult> {
  const token = requireProviderEnv("HUBSPOT_PRIVATE_APP_TOKEN");
  const response = await providerFetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      limit,
      properties: ["firstname", "lastname", "email", "phone", "jobtitle", "company", "website", "associatedcompanyid"],
      sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
    }),
  }, "HubSpot contacts search");
  const data = await response.json() as HubSpotSearchResponse;
  const contacts = (data.results ?? []).map((item) => {
    const props = item.properties ?? {};
    const email = cleanString(props.email);
    return {
      provider: "hubspot" as const,
      externalId: item.id,
      firstName: cleanString(props.firstname) ?? namePart(email, 0) ?? "HubSpot",
      lastName: cleanString(props.lastname) ?? namePart(email, 1) ?? "Contact",
      email,
      phone: cleanString(props.phone),
      title: cleanString(props.jobtitle),
      companyName: cleanString(props.company),
      companyDomain: domainFromValue(cleanString(props.website) ?? email),
      sourcePayload: item as unknown as Record<string, unknown>,
    };
  });
  return { contacts, sourceCount: data.total ?? contacts.length };
}

async function pullApolloContacts(limit: number): Promise<ProviderPullResult> {
  const token = requireProviderEnv("APOLLO_API_KEY");
  const response = await providerFetch("https://api.apollo.io/api/v1/contacts/search", {
    method: "POST",
    headers: {
      "cache-control": "no-cache",
      "content-type": "application/json",
      "x-api-key": token,
    },
    body: JSON.stringify({ page: 1, per_page: limit }),
  }, "Apollo contacts search");
  const data = await response.json() as ApolloContactsResponse;
  const contacts = (data.contacts ?? []).map((item) => ({
    provider: "apollo" as const,
    externalId: item.id ?? item.contact_id ?? item.email ?? crypto.randomUUID(),
    firstName: cleanString(item.first_name) ?? nameFromFull(item.name, 0) ?? namePart(item.email, 0) ?? "Apollo",
    lastName: cleanString(item.last_name) ?? nameFromFull(item.name, 1) ?? namePart(item.email, 1) ?? "Contact",
    email: cleanString(item.email),
    phone: cleanString(item.phone_numbers?.[0]?.raw_number ?? item.phone),
    title: cleanString(item.title),
    companyName: cleanString(item.organization?.name ?? item.account?.name),
    companyDomain: cleanString(item.organization?.primary_domain ?? item.account?.domain) ?? domainFromValue(item.email),
    sourcePayload: item as unknown as Record<string, unknown>,
  }));
  return { contacts, sourceCount: data.pagination?.total_entries ?? contacts.length };
}

async function pullNotionContacts(limit: number): Promise<ProviderPullResult> {
  const token = serverEnv.NOTION_API_KEY || serverEnv.NOTION_TOKEN;
  if (!token) {
    throw new Error("NOTION_API_KEY is required for this capability");
  }
  const response = await providerFetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "notion-version": "2022-06-28",
    },
    body: JSON.stringify({
      page_size: limit,
      filter: { property: "object", value: "page" },
    }),
  }, "Notion search");
  const data = await response.json() as NotionSearchResponse;
  const contacts = (data.results ?? []).map((page) => {
    const title = extractNotionTitle(page) ?? "Notion Contact";
    const email = extractNotionEmail(page);
    const names = splitName(title);
    return {
      provider: "notion" as const,
      externalId: page.id,
      firstName: names.firstName,
      lastName: names.lastName,
      email,
      phone: extractNotionPhone(page),
      title: extractNotionText(page, ["Title", "Role", "Job Title"]),
      companyName: extractNotionText(page, ["Company", "Account", "Organization"]),
      companyDomain: domainFromValue(extractNotionText(page, ["Domain", "Website", "URL"]) ?? email),
      sourcePayload: page as unknown as Record<string, unknown>,
    };
  });
  return { contacts, sourceCount: contacts.length };
}

async function pullGoHighLevelContacts(limit: number): Promise<ProviderPullResult> {
  const token = requireProviderEnv("GHL_API_KEY");
  const locationId = serverEnv.GHL_LOCATION_ID;
  const body = locationId ? { locationId, pageLimit: limit } : { pageLimit: limit };
  const response = await providerFetch("https://services.leadconnectorhq.com/contacts/search", {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      version: serverEnv.GHL_API_VERSION || "2021-07-28",
    },
    body: JSON.stringify(body),
  }, "GoHighLevel contacts search");
  const data = await response.json() as GoHighLevelContactsResponse;
  const contacts = (data.contacts ?? []).slice(0, limit).map((item) => ({
    provider: "gohighlevel" as const,
    externalId: item.id ?? item.contactId ?? item.email ?? crypto.randomUUID(),
    firstName: cleanString(item.firstName ?? item.first_name) ?? nameFromFull(item.name, 0) ?? namePart(item.email, 0) ?? "GHL",
    lastName: cleanString(item.lastName ?? item.last_name) ?? nameFromFull(item.name, 1) ?? namePart(item.email, 1) ?? "Contact",
    email: cleanString(item.email),
    phone: cleanString(item.phone),
    title: cleanString(item.title),
    companyName: cleanString(item.companyName ?? item.businessName),
    companyDomain: domainFromValue(cleanString(item.website) ?? item.email),
    sourcePayload: item as unknown as Record<string, unknown>,
  }));
  return { contacts, sourceCount: data.total ?? contacts.length };
}

async function upsertCompany(organizationId: string, contact: NormalizedContact) {
  const name = contact.companyName ?? contact.companyDomain ?? `${providerLabels[contact.provider]} Imported Account`;
  const domain = contact.companyDomain;
  if (domain) {
    const rows = await sql()`
      insert into crm_companies (organization_id, name, domain, industry, lifecycle_stage, health_score)
      values (${organizationId}, ${name}, ${domain}, ${providerLabels[contact.provider]}, 'imported', 62)
      on conflict (organization_id, domain) do update set
        name = coalesce(nullif(excluded.name, ''), crm_companies.name),
        industry = coalesce(crm_companies.industry, excluded.industry),
        updated_at = now()
      returning id
    `;
    return String(rows[0].id);
  }

  const rows = await sql()`
    insert into crm_companies (organization_id, name, industry, lifecycle_stage, health_score)
    values (${organizationId}, ${name}, ${providerLabels[contact.provider]}, 'imported', 62)
    returning id
  `;
  return String(rows[0].id);
}

async function upsertContact(organizationId: string, companyId: string | null, contact: NormalizedContact) {
  if (contact.email) {
    const rows = await sql()`
      insert into crm_contacts (
        organization_id, company_id, first_name, last_name, email, phone, title, authority_level
      ) values (
        ${organizationId}, ${companyId}, ${contact.firstName}, ${contact.lastName}, ${contact.email}, ${contact.phone}, ${contact.title}, 55
      )
      on conflict (organization_id, email) do update set
        company_id = coalesce(excluded.company_id, crm_contacts.company_id),
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        phone = coalesce(excluded.phone, crm_contacts.phone),
        title = coalesce(excluded.title, crm_contacts.title),
        updated_at = now()
      returning id
    `;
    return String(rows[0].id);
  }

  const rows = await sql()`
    insert into crm_contacts (
      organization_id, company_id, first_name, last_name, email, phone, title, authority_level
    ) values (
      ${organizationId}, ${companyId}, ${contact.firstName}, ${contact.lastName}, null, ${contact.phone}, ${contact.title}, 55
    )
    returning id
  `;
  return String(rows[0].id);
}

async function providerFetch(url: string, init: RequestInit, label: string) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${label} failed with ${response.status}: ${body.slice(0, 240)}`);
  }
  return response;
}

function requireProviderEnv(name: keyof typeof serverEnv) {
  const value = serverEnv[name];
  if (!value) {
    throw new Error(`${name} is required for this capability`);
  }
  return value;
}

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function namePart(email: unknown, index: 0 | 1) {
  const value = cleanString(email);
  if (!value?.includes("@")) {
    return null;
  }
  const parts = value.split("@")[0].replace(/[._-]+/g, " ").split(" ").filter(Boolean);
  return parts[index] ? capitalize(parts[index]) : null;
}

function nameFromFull(name: unknown, index: 0 | 1) {
  const value = cleanString(name);
  if (!value) {
    return null;
  }
  return splitName(value)[index === 0 ? "firstName" : "lastName"];
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Imported",
    lastName: parts.slice(1).join(" ") || "Contact",
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function domainFromValue(value: unknown) {
  const text = cleanString(value);
  if (!text) {
    return null;
  }
  if (text.includes("@")) {
    return text.split("@")[1]?.toLowerCase() ?? null;
  }
  try {
    return new URL(text.startsWith("http") ? text : `https://${text}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return text.includes(".") ? text.replace(/^www\./, "").toLowerCase() : null;
  }
}

function extractNotionTitle(page: NotionPage) {
  for (const property of Object.values(page.properties ?? {})) {
    if (property.type === "title") {
      return property.title?.map((item) => item.plain_text).join("").trim() || null;
    }
  }
  return null;
}

function extractNotionEmail(page: NotionPage) {
  for (const property of Object.values(page.properties ?? {})) {
    if (property.type === "email" && property.email) {
      return property.email;
    }
  }
  return extractNotionText(page, ["Email", "Contact Email"]);
}

function extractNotionPhone(page: NotionPage) {
  for (const property of Object.values(page.properties ?? {})) {
    if (property.type === "phone_number" && property.phone_number) {
      return property.phone_number;
    }
  }
  return extractNotionText(page, ["Phone", "Mobile"]);
}

function extractNotionText(page: NotionPage, names: string[]) {
  for (const name of names) {
    const property = page.properties?.[name];
    if (!property) {
      continue;
    }
    if (property.type === "rich_text") {
      return property.rich_text?.map((item) => item.plain_text).join("").trim() || null;
    }
    if (property.type === "url") {
      return property.url ?? null;
    }
    if (property.type === "select") {
      return property.select?.name ?? null;
    }
  }
  return null;
}

type HubSpotSearchResponse = {
  total?: number;
  results?: Array<{ id: string; properties?: Record<string, string | null> }>;
};

type ApolloContactsResponse = {
  contacts?: Array<{
    id?: string;
    contact_id?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    email?: string;
    phone?: string;
    phone_numbers?: Array<{ raw_number?: string }>;
    title?: string;
    organization?: { name?: string; primary_domain?: string };
    account?: { name?: string; domain?: string };
  }>;
  pagination?: { total_entries?: number };
};

type NotionSearchResponse = {
  results?: NotionPage[];
};

type NotionPage = {
  id: string;
  properties?: Record<string, {
    type?: string;
    title?: Array<{ plain_text: string }>;
    rich_text?: Array<{ plain_text: string }>;
    email?: string | null;
    phone_number?: string | null;
    url?: string | null;
    select?: { name?: string } | null;
  }>;
};

type GoHighLevelContactsResponse = {
  total?: number;
  contacts?: Array<{
    id?: string;
    contactId?: string;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
    companyName?: string;
    businessName?: string;
    website?: string;
  }>;
};
