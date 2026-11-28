import type { Publication } from "@/lib/exploration";

const GROUPS = [
  { relation: "direct", title: "Directly linked publications", description: "The entity source explicitly links these publications." },
  { relation: "related", title: "Search-based related literature", description: "PubMed matched entity and organism terms. Relevance can vary." },
] as const;

function Article({ article }: { article: Publication }) {
  return (
    <li className="flex min-w-0 flex-col gap-xs rounded-md border border-outline-subtle p-sm text-body-sm [overflow-wrap:anywhere]">
      <h5 className="font-semibold text-on-surface">
        <a href={article.source_url} className="text-primary underline">{article.title}</a>
      </h5>
      {article.authors.length > 0 && <p>{article.authors.join(", ")}</p>}
      <p className="text-on-surface-variant">{[article.journal, article.year].filter(Boolean).join(" · ")}</p>
      <p className="flex flex-wrap gap-x-sm">
        <a href={article.source_url} className="text-primary underline">PubMed · PMID {article.pmid}</a>
        {article.doi && <a href={`https://doi.org/${encodeURIComponent(article.doi)}`} className="text-primary underline">DOI {article.doi}</a>}
      </p>
      <p className="text-on-surface-variant">Discovery: {article.relation_source}</p>
      {article.abstract && article.abstract_license ? (
        <details>
          <summary className="cursor-pointer font-semibold text-primary">Read abstract</summary>
          <p className="mt-xs whitespace-pre-line">{article.abstract}</p>
          <a className="text-primary underline" href={article.abstract_license}>Abstract license</a>
        </details>
      ) : article.abstract_available && <a href={article.source_url} className="w-fit text-primary underline">Read abstract on PubMed</a>}
    </li>
  );
}

export function LiteratureResults({ records }: { records: Publication[] }) {
  return (
    <div className="flex flex-col gap-md">
      {GROUPS.map(({ relation, title, description }) => {
        const articles = records.filter((record) => record.relation === relation);
        return (
          <section key={relation} className="flex flex-col gap-sm">
            <h4 className="font-label text-label-md">{title}</h4>
            <p className="text-body-sm text-on-surface-variant">{description}</p>
            {articles.length > 0
              ? <ul className="flex flex-col gap-sm">{articles.map((article) => <Article key={article.pmid} article={article} />)}</ul>
              : <p className="text-body-sm text-on-surface-variant">No publications in this group.</p>}
          </section>
        );
      })}
    </div>
  );
}
