const baseUrl = process.env.REVENUEOS_BASE_URL ?? "https://revenueos.itechsmart.dev";
const workerToken = process.env.REVENUEOS_WORKER_TOKEN;

const checks = [
  {
    name: "health",
    method: "GET",
    path: "/api/health",
    expectStatus: 200,
    validate: (json) => json?.ok === true && json?.data?.status === "ready",
  },
  {
    name: "app route",
    method: "GET",
    path: "/app",
    expectStatus: 200,
    text: true,
  },
  {
    name: "customer success fails closed",
    method: "GET",
    path: "/api/customer-success",
    expectStatus: 401,
  },
  {
    name: "proposals fails closed",
    method: "GET",
    path: "/api/proposals",
    expectStatus: 401,
  },
  {
    name: "automations fails closed",
    method: "GET",
    path: "/api/automations",
    expectStatus: 401,
  },
  {
    name: "integrations fails closed",
    method: "GET",
    path: "/api/integrations",
    expectStatus: 401,
  },
  {
    name: "admin security fails closed",
    method: "GET",
    path: "/api/admin/security",
    expectStatus: 401,
  },
];

if (workerToken) {
  checks.push(
    {
      name: "provider health",
      method: "GET",
      path: "/api/workers/providers/health",
      expectStatus: 200,
      headers: { authorization: `Bearer ${workerToken}` },
      validate: (json) => {
        const providers = json?.data?.providers ?? [];
        return providers.some((provider) => provider.provider === "resend" && provider.ok)
          && providers.some((provider) => provider.provider === "nemotron" && provider.ok);
      },
    },
    {
      name: "email dry-run",
      method: "POST",
      path: "/api/workers/email/test",
      expectStatus: 200,
      headers: { authorization: `Bearer ${workerToken}`, "content-type": "application/json" },
      body: JSON.stringify({ recipient: "noreply@itechsmart.dev", dryRun: true }),
      validate: (json) => json?.ok === true && json?.data?.dryRun === true && json?.data?.wouldSend === true,
    },
  );
}

let failed = 0;
for (const check of checks) {
  const response = await fetch(new URL(check.path, baseUrl), {
    method: check.method,
    headers: check.headers,
    body: check.body,
  });
  const payload = check.text ? await response.text() : await response.json().catch(() => undefined);
  const statusOk = response.status === check.expectStatus;
  const payloadOk = check.validate ? check.validate(payload) : true;
  if (!statusOk || !payloadOk) {
    failed += 1;
    console.error(`FAIL ${check.name}: status=${response.status}, expected=${check.expectStatus}`);
    if (!check.text) {
      console.error(JSON.stringify(payload, null, 2));
    }
  } else {
    console.log(`PASS ${check.name}`);
  }
}

if (!workerToken) {
  console.log("SKIP worker-token checks: REVENUEOS_WORKER_TOKEN is not set.");
}

if (failed > 0) {
  process.exit(1);
}
