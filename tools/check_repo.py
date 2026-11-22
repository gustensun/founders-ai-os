#!/usr/bin/env python3
"""check_repo.py: run this before you commit or push.

  python3 tools/check_repo.py

Checks
  1. Secrets: no API keys, tokens, private keys or .env files.
  2. Personal details: no names, places, brands or live IDs from the original install,
     and no real email addresses outside the allowed placeholder domains.
  3. Links: every relative link in a markdown file points to a file and heading that exist.
  4. Syntax: every JSON file parses, and every JavaScript file passes `node --check` when Node is installed.
  5. Writing (optional): set SLOP_SCAN to the path of slop_scan.py to check the guides for AI writing tells.

It exits with 1 when it finds a problem, so you can use it in a pre-commit hook or a CI job.
"""

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "node_modules", "vendor", "__pycache__", ".vercel", ".taste-skill", "test-results", "playwright-report"}
TEXT_EXT = {".md", ".txt", ".py", ".json", ".js", ".mjs", ".cjs", ".html", ".css", ".sql", ".toml", ".yml", ".yaml", ".svg", ".example"}
TEXT_NAMES = {"LICENSE", ".gitignore", ".vercelignore"}
DOCS = ["README.md", "START-HERE.md", "SETUP.md", "CUSTOMIZE.md", "AGENTS.md", "CLAUDE.md", "GEMINI.md", "THIRD_PARTY_NOTICES.md"]

# Names, places, brands and live IDs from the original install. Stored as SHA-256 hashes of the
# lowercase phrase (words of letters and digits joined by one space) so this file doesn't spell them out.
# To add your own: python3 -c "import hashlib; print(hashlib.sha256(b'your phrase').hexdigest())"
BLOCKED_HASHES = {
    "03d60c09aeee45ad99d35a77f003330a81483ba284601d5d030baf9b9ee47976",
    "0a00c278cb9a4e7aaf5c9bb3a4378f3f0b71f0ca2da44fc7be9edafe6c3a1931",
    "16cc2fc0413e2b3d569f5465446e6dd0028d57eb85aae433618774f585abd9f0",
    "217ef39d9d59b7268bad96f61566cd3dcb06cddcef6ab3da9d8ce529602ce036",
    "2904dffee8b0bb27fff8e1183f42c73c98c5e26637156b36e04ca433ef241a4c",
    "3f433510b3b6c24322388c7ab736fd68f9ee80d065c75c9bc50fd13412e624d4",
    "42d5b6f7cd4d84be683e61e5648b1b14a687f8d7cf9363c00ce0af47b5683f39",
    "46bfd83caaf96938908f915306a5ff53d65a970517ff557a35c843cc488acd4b",
    "5360c47b3e9c37a7c316e771532873aa8093be6f5a2ef441c13733247e67d3a4",
    "53e98f82e6090430bd4004fec6d5a8744ab0a7756ca0a90af3365f3e217795a2",
    "5477e9c008ec4a1c135b54e2dc33157b86b434700025975c744a1f6226be7ad2",
    "8f308606012e2ddde9c7a8e8b90c56a748b9c10835329c81c0a97fe89de70bd0",
    "974b26cf5bdbe853d97d842ef7658da0ef9e5ac6886e45e464fe048682859cf2",
    "983f47b3080502d40b8d477e532f13f12c9e65eef2b3dabcb3d76ac804e3be13",
    "bf49d6090d2a65c4a4a7ad8e801b2a3c3f62f42d84c374c2d0fb9228159e2d3d",
    "d6ee31cabfe60c244ef9bdfa84c5563148c459f7f78aebf43ea75292a9d4d1a0",
}
# The author credit may appear in these files only.
CREDIT_FILES = {"README.md", "LICENSE"}
CREDIT_HASHES = {
    "16cc2fc0413e2b3d569f5465446e6dd0028d57eb85aae433618774f585abd9f0",
    "5477e9c008ec4a1c135b54e2dc33157b86b434700025975c744a1f6226be7ad2",
}
# Exact text that may appear anywhere: the address of the original repository, used in "Getting updates".
ALLOWED_TEXT = ["github.com/gustensun/founders-ai-os"]
WORD_RE = re.compile(r"[a-z0-9]+")

SECRET_PATTERNS = [
    ("Anthropic key", r"sk-ant-[A-Za-z0-9_-]{20,}"),
    ("OpenAI project key", r"sk-proj-[A-Za-z0-9_-]{20,}"),
    ("OpenRouter key", r"sk-or-[A-Za-z0-9_-]{20,}"),
    ("OpenAI key", r"\bsk-[A-Za-z0-9]{32,}\b"),
    ("ElevenLabs key", r"\bsk_[a-f0-9]{40,}\b"),
    ("GitHub token", r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    ("GitHub token", r"github_pat_[A-Za-z0-9_]{40,}"),
    ("Google API key", r"AIza[0-9A-Za-z_-]{35}"),
    ("Supabase secret key", r"sb_secret_[A-Za-z0-9_-]{10,}"),
    ("Supabase publishable key", r"sb_publishable_[A-Za-z0-9_-]{20,}"),
    ("HighLevel token", r"\bpit-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b"),
    ("Slack token", r"\bxox[abpr]-[A-Za-z0-9-]{10,}"),
    ("Stripe key", r"\b[rs]k_live_[A-Za-z0-9]{20,}"),
    ("AWS key", r"\bAKIA[0-9A-Z]{16}\b"),
    ("xAI key", r"\bxai-[A-Za-z0-9]{40,}"),
    ("Perplexity key", r"\bpplx-[A-Za-z0-9]{40,}"),
    ("Private key", r"-----BEGIN [A-Z ]*PRIVATE KEY-----\s*[A-Za-z0-9+/=\s]{40,}"),
    ("JSON web token", r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
]
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})")
ALLOWED_EMAIL_DOMAINS = {"example.com", "example.net", "example.org", "yourdomain.com"}  # and any domain ending in .example
ALLOWED_EMAILS = {"onboarding@resend.dev"}
NOT_EMAIL_ENDINGS = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".js", ".mjs", ".css", ".json")
# Text copied from MIT licensed skill repos, with their own placeholder addresses. Secrets and names are still checked.
THIRD_PARTY_TEXT = {"api/_skill-library.json"}

NODE_CHECK = (
    "const fs=require('fs'),vm=require('vm'),M=require('module');"
    "for(const f of process.argv.slice(1)){try{new vm.Script(M.wrap(fs.readFileSync(f,'utf8')),{filename:f})}"
    "catch(e){console.log(f+'\\t'+String(e.message).split('\\n')[0])}}"
)
LINK_RE = re.compile(r"\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
HEADING_RE = re.compile(r"^#{1,6}\s+(.*?)\s*#*\s*$")


def walk():
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = sorted(d for d in dns if d not in SKIP_DIRS)
        for fn in sorted(fns):
            if os.path.splitext(fn)[1] in TEXT_EXT or fn in TEXT_NAMES or fn.startswith(".env"):
                yield os.path.join(dp, fn)


def rel(p):
    return os.path.relpath(p, ROOT).replace(os.sep, "/")


def line_of(text, pos):
    return text.count("\n", 0, pos) + 1


def blocked_phrases(text, cache={}):
    """Yield (line, phrase, hash) for every 1 to 3 word phrase on the blocked list."""
    low = text.lower()
    words = [(m.group(0), m.start()) for m in WORD_RE.finditer(low)]
    for size in (1, 2, 3):
        for i in range(len(words) - size + 1):
            phrase = " ".join(w for w, _ in words[i:i + size])
            if phrase not in cache:
                digest = hashlib.sha256(phrase.encode()).hexdigest()
                cache[phrase] = digest if digest in BLOCKED_HASHES else None
            if cache[phrase]:
                yield line_of(low, words[i][1]), phrase, cache[phrase]


def slug(heading, seen):
    s = re.sub(r"[`*_~]|\[|\]\([^)]*\)", "", heading).strip().lower()
    s = re.sub(r"[^\w\- ]", "", s).replace(" ", "-")
    n = seen.get(s, 0)
    seen[s] = n + 1
    return s if n == 0 else f"{s}-{n}"


def anchors(path, cache={}):
    if path not in cache:
        seen, found, fence = {}, set(), False
        for line in open(path, encoding="utf-8"):
            if line.lstrip().startswith("```"):
                fence = not fence
                continue
            m = None if fence else HEADING_RE.match(line)
            if m:
                found.add(slug(m.group(1), seen))
        cache[path] = found
    return cache[path]


def main():
    errors, notes = [], []

    for path in walk():
        r = rel(path)
        name = os.path.basename(path)
        if name.startswith(".env") and name != ".env.example":
            errors.append(f"{r} is an environment file. Delete it and keep values in Vercel instead.")
            continue
        try:
            text = open(path, encoding="utf-8").read()
        except UnicodeDecodeError:
            continue

        # 1. secrets
        if r != "tools/check_repo.py":
            for label, pat in SECRET_PATTERNS:
                for m in re.finditer(pat, text):
                    errors.append(f"{r}:{line_of(text, m.start())} possible {label}. Remove it and keep it in Vercel or in the app's Connections.")
        if name == ".env.example":
            for i, line in enumerate(text.splitlines(), 1):
                m = re.match(r"^([A-Z0-9_]+)=(\S*)", line)
                if m and m.group(2) and not m.group(2).startswith("#"):
                    errors.append(f"{r}:{i} {m.group(1)} has a value. Leave every value in .env.example empty.")

        # 2. personal details
        scan = text
        for allowed in ALLOWED_TEXT:
            scan = scan.replace(allowed, " " * len(allowed))
        for line, phrase, digest in blocked_phrases(scan):
            if digest in CREDIT_HASHES and r in CREDIT_FILES:
                continue
            errors.append(f"{r}:{line} name, place, brand or live ID from the original install: '{phrase}'. "
                          f"If it's your own wording, delete the hash starting {digest[:12]} from BLOCKED_HASHES in this file.")
        if r != "tools/check_repo.py" and r not in THIRD_PARTY_TEXT:
            for m in EMAIL_RE.finditer(text):
                email, domain = m.group(0), m.group(1).lower()
                if m.start() and text[m.start() - 1] == "\\":
                    continue  # an escape such as \n before a social handle, not an address
                if email.lower().endswith(NOT_EMAIL_ENDINGS) or domain in ALLOWED_EMAIL_DOMAINS or domain.endswith(".example") or email.lower() in ALLOWED_EMAILS:
                    continue
                errors.append(f"{r}:{line_of(text, m.start())} real-looking email address '{email}'. Use an example.com address.")

        # 3. links
        if r.endswith(".md"):
            for m in LINK_RE.finditer(text):
                target = m.group(1)
                if target.startswith(("http://", "https://", "mailto:")):
                    continue
                file_part, _, frag = target.partition("#")
                dest = os.path.normpath(os.path.join(os.path.dirname(path), file_part)) if file_part else path
                where = f"{r}:{line_of(text, m.start())}"
                if not os.path.exists(dest):
                    errors.append(f"{where} broken link -> {target}")
                elif frag and dest.endswith(".md") and frag not in anchors(dest):
                    errors.append(f"{where} link to a heading that doesn't exist -> {target}")

        # 4. JSON
        if r.endswith(".json"):
            try:
                json.loads(text)
            except ValueError as e:
                errors.append(f"{r} is not valid JSON: {e}")

    # 4. JavaScript
    node = shutil.which("node")
    if node:
        js = []
        for folder in ("js", "api", "scripts/skills"):
            d = os.path.join(ROOT, folder)
            if os.path.isdir(d):
                js += [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.endswith((".js", ".cjs"))]
        js.append(os.path.join(ROOT, "charts.js"))
        js = [f for f in js if os.path.exists(f)]
        # One Node process parses every file the way `node --check` does, which is much faster than one process per file.
        res = subprocess.run([node, "-e", NODE_CHECK, *js], capture_output=True, text=True)
        for line in res.stdout.splitlines():
            f, _, msg = line.partition("\t")
            errors.append(f"{rel(f)} has a syntax error: {msg}")
        if res.returncode and not res.stdout:
            errors.append("The JavaScript syntax check couldn't run: " + (res.stderr.strip().splitlines() or ["unknown error"])[0])
    else:
        notes.append("Node isn't installed, so the JavaScript syntax check was skipped.")

    # 5. writing
    scanner = os.environ.get("SLOP_SCAN")
    if scanner:
        if not os.path.exists(scanner):
            errors.append(f"SLOP_SCAN points to {scanner}, which doesn't exist.")
        else:
            for doc in DOCS:
                p = os.path.join(ROOT, doc)
                if not os.path.exists(p):
                    continue
                res = subprocess.run([sys.executable, scanner, p], capture_output=True, text=True)
                out = (res.stdout + res.stderr).strip()
                if res.returncode:
                    errors.append(f"{doc} has writing findings:\n{out}")
    else:
        notes.append("Writing check skipped. Set SLOP_SCAN to the path of slop_scan.py to run it.")

    for n in notes:
        print("NOTE  ", n)
    for e in errors:
        print("ERROR ", e)
    print(f"\n{len(errors)} problem{'' if len(errors) == 1 else 's'} found" if errors else "\nAll checks passed")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
