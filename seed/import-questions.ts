import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import type { Question } from "../src/types";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing seed questions.");
}

const questionFile = new URL("./questions.json", import.meta.url);
const questions = JSON.parse(await readFile(questionFile, "utf8")) as Question[];
const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const { error } = await client.from("questions").upsert(questions, { onConflict: "id" });

if (error) {
  throw new Error(`Question import failed: ${error.message}`);
}

console.log(`Imported ${questions.length} sample questions.`);
