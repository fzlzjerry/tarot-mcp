import { Fragment } from "react";

function inline(text: string) {
  return text
    .split(/(\*\*[^*\n]+\*\*)/)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
}

/** Render the engine's paragraphs, headings and emphasis as escaped React text. */
export function ReadingInterpretation({ text }: { text: string }) {
  return (
    <div className="interpretation-copy">
      {text
        .trim()
        .split(/\n\s*\n/)
        .map((block, index) => {
          const heading = /^#{1,4}\s+([^\n]+)$/.exec(block);
          if (heading) return <h3 key={index}>{inline(heading[1])}</h3>;
          const lines = block.split("\n");
          if (lines.every((line) => /^[-*]\s+/.test(line))) {
            return (
              <ul key={index}>
                {lines.map((line, lineIndex) => (
                  <li key={lineIndex}>
                    {inline(line.replace(/^[-*]\s+/, ""))}
                  </li>
                ))}
              </ul>
            );
          }
          return <p key={index}>{inline(block)}</p>;
        })}
    </div>
  );
}
