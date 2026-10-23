import React from "react";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import type { Book, BookPersonSection } from "@/lib/book";

/**
 * Family book PDF (issue #39) — the keepsake typesetter. Fraunces for
 * display type, evergreen/gold accents on aged paper, generous margins:
 * worthy of gifting, not a database dump. Pure Node (@react-pdf), so it
 * runs on Vercel serverless without headless Chrome.
 */

// Vendored Fraunces TTFs (OFL license alongside; converted from
// @fontsource-variable/fraunces) — WOFF2 decompression crashes inside the
// Next server runtime, and bundlers rewrite require.resolve() to virtual
// ids, so we ship real .ttf files and point fontkit at them by path.
function fontFile(name: string): string {
  return path.join(process.cwd(), "assets", "fonts", name);
}

let frauncesRegistered = false;
function ensureFonts() {
  if (frauncesRegistered) return;
  Font.register({
    family: "Fraunces",
    fonts: [
      { src: fontFile("fraunces-latin-full-normal.ttf") },
      { src: fontFile("fraunces-latin-full-italic.ttf"), fontStyle: "italic" },
    ],
  });
  frauncesRegistered = true;
}

const INK = "#292524";
const EVERGREEN = "#2f5d50";
const GOLD = "#b98a2f";
const PAPER = "#faf6ec";
const MUTED = "#78716c";

const styles = StyleSheet.create({
  page: {
    backgroundColor: PAPER,
    padding: 56,
    fontSize: 10.5,
    fontFamily: "Fraunces",
    color: INK,
    lineHeight: 1.5,
  },
  cover: {
    backgroundColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
    padding: 64,
    fontFamily: "Fraunces",
  },
  coverKicker: { fontSize: 11, color: GOLD, letterSpacing: 3 },
  coverRule: { width: 64, height: 3, backgroundColor: GOLD, marginVertical: 24 },
  coverTitle: { fontSize: 34, color: EVERGREEN, textAlign: "center", lineHeight: 1.25 },
  coverSub: { fontSize: 12, color: MUTED, marginTop: 18, textAlign: "center" },
  coverStats: { fontSize: 10, color: INK, marginTop: 8, textAlign: "center" },
  h1: { fontSize: 20, color: EVERGREEN, marginBottom: 14 },
  chapterTitle: {
    fontSize: 15,
    color: EVERGREEN,
    borderTop: 2,
    borderColor: GOLD,
    paddingTop: 10,
    marginBottom: 10,
  },
  appendixTitle: { color: MUTED },
  personName: { fontSize: 13, color: INK },
  redactedName: { color: MUTED, fontStyle: "italic" },
  lifeLine: { fontSize: 9.5, color: EVERGREEN, marginTop: 2 },
  factRow: { flexDirection: "row", marginTop: 2 },
  factLabel: { width: 62, fontSize: 9, color: MUTED },
  factValue: { flex: 1, fontSize: 10, color: INK },
  sectionLabel: {
    fontSize: 8.5,
    color: GOLD,
    marginTop: 8,
    marginBottom: 2,
  },
  body: { fontSize: 10, marginTop: 5 },
  memoryBody: { fontSize: 10 },
  memoryMeta: { fontSize: 8.5, color: MUTED, marginTop: 1 },
  memoryPhoto: {
    width: 120,
    height: 120,
    objectFit: "cover",
    borderRadius: 6,
    marginTop: 6,
  },
  portrait: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
    objectFit: "cover",
  },
  listItem: { flexDirection: "row", marginTop: 2 },
  bullet: { width: 10, color: GOLD },
  tocRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 3 },
  tocName: { fontSize: 10.5 },
  tocGen: { fontSize: 10.5, color: GOLD },
  tocNames: { fontSize: 9, color: MUTED, marginTop: 1 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    textAlign: "center",
    fontSize: 8,
    color: MUTED,
    borderTop: 0.5,
    borderColor: "#e7ddc9",
    paddingTop: 6,
  },
  timelineRow: { flexDirection: "row", marginTop: 2 },
  timelineDate: { width: 90, fontSize: 9.5, color: EVERGREEN },
  timelineText: { flex: 1, fontSize: 9.5 },
});

const KIND_LABEL: Record<string, string> = {
  birth: "Born",
  death: "Died",
  marriage: "Married",
  divorce: "Divorced",
  relocation: "Moved",
  custom: "Life event",
};

function chapterLabel(generation: number, minGeneration: number): string {
  if (generation >= 900) return "Other family";
  const up = generation - Math.min(0, minGeneration);
  return up === 0 ? "The focus generation" : `Generation ${up}`;
}

function PersonCard({
  section,
  images,
}: {
  section: BookPersonSection;
  images: Map<string, Buffer>;
}) {
  const portrait = section.photoMediaId ? images.get(section.photoMediaId) : null;
  return (
    <View wrap={false} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {portrait ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={portrait} style={styles.portrait} />
        ) : null}
        <View>
          <Text style={section.redacted ? styles.redactedName : styles.personName}>
            {section.displayName}
          </Text>
          {section.lifeLine ? <Text style={styles.lifeLine}>{section.lifeLine}</Text> : null}
        </View>
      </View>

      {section.facts.length > 0 ? (
        <View style={{ marginTop: 5 }}>
          {section.facts.map(([label, value]) => (
            <View key={label} style={styles.factRow}>
              <Text style={styles.factLabel}>{label}</Text>
              <Text style={styles.factValue}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {section.notes ? <Text style={styles.body}>{section.notes}</Text> : null}

      {section.events.length > 0 ? (
        <View>
          <Text style={styles.sectionLabel}>LIFE EVENTS</Text>
          {section.events.slice(0, 10).map((e) => (
            <View key={e.id} style={styles.listItem}>
              <Text style={styles.bullet}>·</Text>
              <Text style={styles.factValue}>
                {[e.dateText, KIND_LABEL[e.kind] ?? e.kind, e.placeText, e.note]
                  .filter(Boolean)
                  .join(" — ")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {section.memories.length > 0 ? (
        <View>
          <Text style={styles.sectionLabel}>MEMORIES</Text>
          {section.memories.slice(0, 12).map((m) => {
            const photo = m.kind === "photo" && m.mediaId ? images.get(m.mediaId) : null;
            return (
              <View key={m.id} wrap={false} style={{ marginTop: 5 }}>
                {photo ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={photo} style={styles.memoryPhoto} />
                ) : null}
                <Text style={styles.memoryBody}>
                  {m.kind === "voice" && !m.body
                    ? "A voice memory the family can play in the app."
                    : m.body}
                </Text>
                <Text style={styles.memoryMeta}>
                  {[
                    m.kind === "voice" ? "Voice memory" : m.kind === "photo" ? "Photo" : null,
                    m.occurredText,
                    m.authorName ? `remembered by ${m.authorName}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export interface BookPdfOptions {
  paper: "A4" | "LETTER";
  images: Map<string, Buffer>;
  compiledOnMs: number;
}

export async function renderBookPdf(book: Book, opts: BookPdfOptions): Promise<Buffer> {
  ensureFonts();
  const compiled = new Date(opts.compiledOnMs).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
  const minGeneration = Math.min(0, ...book.chapters.map((c) => c.generation));

  const doc = (
    <Document title={`${book.title} — family book`} author="fam.link" language="en">
      <Page size={opts.paper} style={styles.cover}>
        <Text style={styles.coverKicker}>A FAMILY BOOK</Text>
        <View style={styles.coverRule} />
        <Text style={styles.coverTitle}>{book.title}</Text>
        <View style={styles.coverRule} />
        <Text style={styles.coverSub}>{compiled}</Text>
        <Text style={styles.coverStats}>
          {book.stats.totalPersons} relatives · {book.stats.generations} generation
          {book.stats.generations === 1 ? "" : "s"} · {book.stats.memories} memories
        </Text>
      </Page>

      <Page size={opts.paper} style={styles.page}>
        <Text style={styles.h1}>Contents</Text>
        {book.chapters.map((c) => (
          <View key={`toc-${c.generation}`}>
            <View style={styles.tocRow}>
              <Text style={styles.tocName}>
                {chapterLabel(c.generation, minGeneration)}
              </Text>
              <Text style={styles.tocGen}>{c.sections.length}</Text>
            </View>
            <Text style={styles.tocNames}>
              {c.sections.map((s) => s.displayName).join(" · ")}
            </Text>
          </View>
        ))}
        {book.timeline.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.h1}>Family timeline</Text>
            {book.timeline.slice(0, 40).map((t, i) => (
              <View key={`tl-${i}`} style={styles.timelineRow}>
                <Text style={styles.timelineDate}>{t.dateText}</Text>
                <Text style={styles.timelineText}>{t.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Page>

      {book.chapters.map((c) => (
        <Page key={`ch-${c.generation}`} size={opts.paper} style={styles.page}>
          <Text
            style={
              c.generation >= 900
                ? [styles.chapterTitle, styles.appendixTitle]
                : styles.chapterTitle
            }
          >
            {chapterLabel(c.generation, minGeneration)}
          </Text>
          {c.sections.map((s) => (
            <PersonCard key={s.id} section={s} images={opts.images} />
          ))}
          <Text style={styles.footer} fixed>
            {book.title} — compiled with fam.link
          </Text>
        </Page>
      ))}
    </Document>
  );

  return renderToBuffer(doc);
}
