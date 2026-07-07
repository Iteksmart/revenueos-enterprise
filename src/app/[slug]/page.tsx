import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KnowledgePage } from "@/components/KnowledgePage";
import { pageBySlug, sitePages } from "@/content/site-pages";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return sitePages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = pageBySlug.get(slug);
  if (!page) return {};
  return {
    title: `${page.title} | iTechSmart`,
    description: page.description,
    alternates: {
      canonical: page.canonical,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.canonical,
      siteName: "iTechSmart RevenueOS",
      type: "article",
    },
  };
}

export default async function SitePageRoute({ params }: Props) {
  const { slug } = await params;
  const page = pageBySlug.get(slug);
  if (!page) notFound();
  return <KnowledgePage page={page} />;
}
