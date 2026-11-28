# Competition demo and pilot

MoLearn teaches students to trace molecular biology claims to the underlying
record. One workflow connects gene identity, protein function, sequence,
experimental and predicted structures, literature, and network evidence.
The distinctions matter: a gene is not its protein, a prediction is not
an experiment, and a functional association does not establish binding.

## Four-minute demo

1. Search `TP53`, then switch between the Gene and Protein filters. Open
   [NCBI Gene 7157](https://www.ncbi.nlm.nih.gov/gene/7157). Identify the human
   organism and follow the documented GeneID cross-reference to
   [UniProtKB P04637](https://www.uniprot.org/uniprotkb/P04637).
2. Show p53's original annotation and scientific source. Load Sequence and
   download FASTA. In Literature, contrast direct links with related results.
   Show one experimental structure and one AlphaFold prediction. Point out
   deposited chemical components and label STRING edges as functional.
3. Save p53, reload My Collection, then download an entity CSV. If approved,
   open Beginner Explanation or Study Companion and show how to check an
   answer against the source. If AI is unavailable, use the original annotation.
4. Use [UniProtKB P01308](https://www.uniprot.org/uniprotkb/P01308) as a second
   search example. The record is human insulin precursor; the displayed protein
   sequence should not be described as the mature two-chain hormone.

Recheck all records from the demo network. If an upstream provider is
unavailable, describe it accurately and continue with available modules.
Screenshots and any explicitly labeled local demo mode should be presented
as separate evidence.

## Reviewer access

An authorized reviewer opens the production HTTPS page for `7157` or `P04637`.
Enter the separately shared reviewer code in the profile's reviewer access
field. Use **Generate explanation** or submit a question in Study Companion.
Changing entity or reloading clears the current reviewer session. Never
enter an LLM key or put a reviewer code in a URL. See [setup](SLICE3-AI.md).

## Production smoke test

- Confirm the approved revision and HTTPS for both services, with no demo badge.
  Check `/api/v1/health` on Render and `/api/backend/api/v1/health` on Vercel.
- Search `TP53`, filter Gene and Protein, and verify the `7157` → `P04637`
  relationship, taxon `9606`, and the original source URLs. Open `P01308`.
- Load Sequence, Literature, Structure, Ligand and Interaction after the
  profile appears. Check independent status and provenance, then download
  a FASTA and CSV. Save, reload, and remove a collection record.
- Use desktop 1440×900, tablet 768×1024, and mobile 390×844. Check focus
  visibility, control labels, overflow, and one external source link.
- Check that anonymous AI POST requests fail on both the Next.js proxy
  and direct backend. With reviewer AI enabled, require HTTP 403. If fully
  disabled, require HTTP 503. Verify no authorization data in host logs.
- **After explicit paid-call approval only:** start one fresh backend
  process with `MOLEARN_AI_MAX_CALLS_PER_PROCESS=2`. Use a funded dedicated
  key. Make one explanation request for `7157` and one Study Companion
  request for `P04637` asking which organism the record comes from. Make no
  automatic retries. Require grounded output with the right record links,
  record only outcome/duration/token counts, and check the provider dashboard.
  Disable AI afterwards unless a reviewer window is separately approved.
- Report each item as PASS, FAIL, or NOT TESTED. Record timestamp, deployed
  revisions, viewport, and evidence mode. Stop release for broken primary
  workflows, unsafe authorization, or undisclosed provider substitution.

## Pilot instrument (5–8 participants)

Owner runs this 10–15 minute facilitated pilot. Invite novice biology,
biochemistry, or bioinformatics students with consent. Use participant codes
such as `P01`, and record device and prior familiarity. Do not record names,
reviewer codes, prompts containing personal data, or unrelated screen content.
Run reviewer AI only with separate approval and authorization.

| Task | Ask participant to show | Record |
| --- | --- | --- |
| Discover | Find human TP53 and explain which result is a gene. | Completion, time, help, evidence used |
| Trace | Open human p53 from the gene and identify the source. | Correct identifier and source, missteps |
| Compare | Find a sequence and distinguish the experimental and predicted structures. | Correct distinction, hesitation |
| Reason | Explain what a STRING association does and does not establish. | Participant's words, correct/partial/incorrect |
| Retrieve | Save and reopen p53, then export a CSV or FASTA. | Completion, time, export issues |
| Optional reviewer task | Check an AI answer against its linked source. | Whether the answer was verified, any discrepancy |

For each task, mark **independent**, **with help**, or **not completed**.
Afterward, ask for 1–5 ease and confidence ratings, the least clear label,
and one change that would help. Report actual counts and anonymized quotes.
Record provider outages separately from usability issues. No pilot outcomes
are claimed until the owner conducts testing.
