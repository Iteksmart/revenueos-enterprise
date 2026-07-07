import type { SitePage } from "@/content/site-pages";

export function KnowledgePage({ page }: { page: SitePage }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.title,
    description: page.description,
    url: page.canonical,
    publisher: {
      "@type": "Organization",
      name: "iTechSmart Inc.",
      url: "https://itechsmart.dev",
    },
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <main className="knowledge-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="knowledge-shell">
        <header className="knowledge-hero">
          <p className="knowledge-eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </header>

        <section className="knowledge-proof" aria-label="Proof points">
          <div>
            <span>Audience</span>
            <strong>{page.audience}</strong>
          </div>
          {page.proof.map((item) => (
            <div key={item}>
              <span>Signal</span>
              <strong>{item}</strong>
            </div>
          ))}
        </section>

        <section className="knowledge-grid">
          {page.sections.map((section) => (
            <article className="knowledge-panel" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
        </section>

        <section className="knowledge-faq">
          <h2>FAQ</h2>
          {page.faqs.map((faq) => (
            <article key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
