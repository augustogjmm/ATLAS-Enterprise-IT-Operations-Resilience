# Executive interview walkthrough (5 minutes)

All names, incidents and numbers in ATLAS are **fictional**. The demo is intended to invite an architecture and management conversation, not to claim operational outcomes.

1. **Context (45 sec).** Explain how a service catalog links a business capability to complete dependency paths and recovery objectives. Mention owners and Tier 1 versus Tier 2.
2. **Disruption (60 sec).** Select "Primary data center outage" and observe recovery effects on payments, channels and reporting. Discuss why an alternate data center does not necessarily meet RTO.
3. **Management trade-off (75 sec).** Select "Automated failover runbooks". Compare a shorter modeled recovery time with incremental CAPEX/OPEX. Clarify that the investment must still be validated through exercises.
4. **Correlated failure (60 sec).** Select "Multi-site network partition". Show how two separate compute locations can still depend on a shared operational failure domain.
5. **Governance (60 sec).** Export the assessment as JSON. Explain accountable owners, exception management, test evidence and documented assumptions.

**Executive framing:** I use architectural depth to make better service, investment and continuity decisions. This project is a personal reference simulator; professional experience is separately described in my CV and case studies. No employer technology architecture is reproduced.
