import { VercelApiHandler } from "@vercel/node";
import axios from "axios";

const EVENT_BEGIN = "BEGIN:VEVENT";
const EVENT_END = "END:VEVENT";

const regexBuilder = (subject: string, type: string) => {
  return new RegExp(`^${subject} - [0-9]*\\. ${type}`);
};

const getIgnores = (withArh?: boolean) => {
  const base = [
    regexBuilder("Vjerojatnost i statistika", "predavanje"),
    regexBuilder("Vjerojatnost i statistika", "auditorna vježba"),
    regexBuilder("Teorija informacije", "predavanje"),
    regexBuilder("Programsko inženjerstvo", "predavanje"),
    regexBuilder("Upravljanje znanjem", "predavanje"),
    regexBuilder("Upravljanje znanjem", "auditorna vježba"),
  ];

  if (!withArh) {
    base.push(regexBuilder("Arhitektura računala 1R", "predavanje"));
  }

  return base;
};

const parseDate = (date: string): Date => {
  return new Date(
    parseInt(date.slice(0, 4)),
    parseInt(date.slice(4, 6)),
    parseInt(date.slice(6, 8)),
    parseInt(date.slice(9, 11)),
    parseInt(date.slice(11, 13))
  );
};

const handler: VercelApiHandler = async (req, res) => {
  const response = await axios.get<string>(process.env.CALENDAR_URL);
  const lines = response.data.split("\n").map((line) => line.trim());

  const firstEventIndex = lines.indexOf(EVENT_BEGIN);
  const lastEventIndex = lines.lastIndexOf(EVENT_END);

  const SPLIT = `${EVENT_END}\n${EVENT_BEGIN}`;
  const withArh = req.query["withArh"] === "true";

  const filtered = lines
    .slice(firstEventIndex + 1, lastEventIndex)
    .join("\n")
    .split(SPLIT)
    .map((event) => {
      return Object.fromEntries(
        event
          .trim()
          .split("\n")
          .map((line) => {
            const [key, ...rest] = line.split(":");
            return [key, rest.join(":")];
          })
      );
    })
    .filter((event) => parseDate(event["DTEND;TZID=Europe/Zagreb"]).getTime() > Date.now())
    .filter((event) => getIgnores(withArh).every((regex) => !regex.test(event["SUMMARY"])))
    .map((event) =>
      Object.entries(event)
        .map(([key, value]) => `${key}:${value}`)
        .join("\n")
    )
    .join(`\n${SPLIT}\n`)
    .split("\n");

  const output = [
    ...lines.slice(0, firstEventIndex + 1),
    ...filtered,
    ...lines.slice(lastEventIndex),
  ];

  res.send(output.join("\n"));
};

export default handler;
