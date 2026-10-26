
## odin-cli v1
- [x] src/lib lifted from odin-gui, Jina replaced by curl fetch (Jina kept as fallback)
- [x] kali.ts: whois (domain age), dig, whatweb (stack), Wayback CDX via curl (fallback publish dates), curl outbound-link graph (citation edges), theHarvester (recon subcommand)
- [x] cli.ts: INGEST > EXTRACT > RETRIEVE > RECON > CLASSIFY > PROVENANCE > SCORE, ANSI output, markdown report
- Deviations from GUI: domains under 180 days old forced to tier 1; small tier override map in cli.ts (GUI tier map missing several health/science domains)
- Known: theHarvester crtsh source untested on v5; Reuters blocks curl; deep article URLs often lack Wayback captures

## odin-cli v1
- [x] src/lib lifted from odin-gui, Jina replaced by curl fetch (Jina kept as fallback)
- [x] kali.ts: whois (domain age), dig, whatweb (stack), Wayback CDX via curl (fallback publish dates), curl outbound-link graph (citation edges), theHarvester (recon subcommand)
- [x] cli.ts: INGEST > EXTRACT > RETRIEVE > RECON > CLASSIFY > PROVENANCE > SCORE, ANSI output, markdown report
- Deviations from GUI: domains under 180 days old forced to tier 1; small tier override map in cli.ts (GUI tier map missing several health/science domains)
- Known: theHarvester crtsh source untested on v5; Reuters blocks curl; deep article URLs often lack Wayback captures
