const metrics = [
  { label: "Today's meetings", value: "4", detail: "2 exec, 1 demo, 1 renewal", tone: "blue" },
  { label: "Today's calls", value: "18", detail: "7 priority callbacks", tone: "teal" },
  { label: "Revenue", value: "$184K", detail: "+$58K yesterday", tone: "green" },
  { label: "Pipeline", value: "$1.42M", detail: "72% weighted confidence", tone: "violet" },
  { label: "New leads", value: "31", detail: "12 researched", tone: "amber" },
  { label: "Hot leads", value: "9", detail: "intent score above 82", tone: "red" },
  { label: "Warm leads", value: "44", detail: "nurture active", tone: "orange" },
  { label: "Campaign status", value: "87%", detail: "healthcare launch ready", tone: "blue" },
  { label: "Tasks", value: "23", detail: "6 due before noon", tone: "slate" },
  { label: "AI suggestions", value: "14", detail: "5 expected to move revenue", tone: "teal" },
  { label: "Forecast", value: "$312K", detail: "30-day close window", tone: "green" },
  { label: "Customer health", value: "91", detail: "2 accounts need attention", tone: "violet" },
];

const priorities = [
  { task: "Call ABC Medical", context: "Director opened ROI brief twice", owner: "AI Sales Agent", impact: "$42K" },
  { task: "Send proposal to Smith Law", context: "ProofLink audit package requested", owner: "Proposal Builder", impact: "$28K" },
  { task: "Follow up with City of Savannah", context: "Security questionnaire ready", owner: "Research Agent", impact: "$64K" },
  { task: "Launch Healthcare Campaign", context: "50-account segment scored and approved", owner: "Campaign Agent", impact: "$91K" },
];

const companies = [
  { name: "ABC Medical", fit: 94, intent: 89, authority: 78, urgency: 86, score: 88, stage: "Meeting today" },
  { name: "Smith Law", fit: 91, intent: 82, authority: 93, urgency: 76, score: 86, stage: "Proposal viewed" },
  { name: "City of Savannah", fit: 87, intent: 74, authority: 81, urgency: 83, score: 81, stage: "Security review" },
  { name: "Coastal Dental Group", fit: 84, intent: 71, authority: 69, urgency: 72, score: 74, stage: "Nurture" },
  { name: "Pine Ridge Logistics", fit: 79, intent: 68, authority: 72, urgency: 65, score: 71, stage: "Researching" },
];

const pipeline = [
  { stage: "Search", value: 126, width: 100 },
  { stage: "Prospect", value: 84, width: 79 },
  { stage: "Research", value: 57, width: 61 },
  { stage: "Nurture", value: 42, width: 46 },
  { stage: "Generate", value: 21, width: 28 },
  { stage: "Close", value: 9, width: 16 },
  { stage: "Expand", value: 6, width: 11 },
];

const agentWork = [
  { name: "AI Research Agent", output: "12 company briefs completed", state: "Running", proof: "Decision makers, hiring, tech stack, pain points" },
  { name: "AI Cold Email Writer", output: "5 healthcare sequences drafted", state: "Ready", proof: "Personalized by fit, intent, and urgency" },
  { name: "AI Meeting Prep", output: "3 briefs generated", state: "Ready", proof: "Questions, risks, competitors, budget estimate" },
  { name: "AI Call Notes", output: "2 summaries waiting for approval", state: "Review", proof: "Tasks, follow-up, CRM updates" },
];

const integrations = ["Microsoft 365", "Google", "LinkedIn", "Zoom", "Slack", "Twilio", "QuickBooks", "Stripe", "Mailgun", "n8n"];

export default function RevenueOSEnterprisePage() {
  return (
    <main className="rev-page">
      <section className="rev-shell" aria-label="RevenueOS Enterprise dashboard">
        <header className="rev-command">
          <div>
            <p className="rev-kicker">iTechSmart Core / RevenueOS</p>
            <h1>RevenueOS Enterprise</h1>
            <p>The AI Revenue Operating System that Finds, Qualifies, Nurtures, Closes, and Grows Customers.</p>
          </div>
          <div className="rev-actions" aria-label="Primary actions">
            <button type="button">Generate Proposal</button>
            <button type="button">Prepare Meeting</button>
            <button type="button" className="primary">Launch Campaign</button>
          </div>
        </header>

        <section className="rev-metric-island" aria-label="Revenue metrics">
          {metrics.map((metric) => (
            <article className={`rev-metric ${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </section>

        <section className="rev-grid">
          <article className="rev-panel rev-briefing">
            <div className="rev-panel-head">
              <div>
                <p className="rev-kicker">AI Sales Agent</p>
                <h2>Good morning Kevin.</h2>
              </div>
              <span className="rev-pill success">Live</span>
            </div>
            <div className="rev-briefing-grid">
              <div>
                <span>Yesterday</span>
                <strong>12 new leads</strong>
                <strong>3 replied</strong>
                <strong>1 booked</strong>
                <strong>2 proposals viewed</strong>
                <strong>Pipeline increased by $58,000</strong>
              </div>
              <div>
                <span>Today's priorities</span>
                {priorities.map((item) => (
                  <div className="rev-priority" key={item.task}>
                    <b>{item.task}</b>
                    <small>{item.context}</small>
                    <em>{item.owner} / {item.impact}</em>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rev-panel">
            <div className="rev-panel-head">
              <div>
                <p className="rev-kicker">SpringCode Automation</p>
                <h2>Revenue Flow</h2>
              </div>
              <span className="rev-pill">Search to Expand</span>
            </div>
            <div className="rev-flow">
              {pipeline.map((row) => (
                <div className="rev-flow-row" key={row.stage}>
                  <span>{row.stage}</span>
                  <div><i style={{ width: `${row.width}%` }} /></div>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="rev-panel rev-wide">
            <div className="rev-panel-head">
              <div>
                <p className="rev-kicker">CRM Intelligence</p>
                <h2>Companies, Deals, Notes, Files, Quotes, Invoices, Tasks, Activities</h2>
              </div>
              <span className="rev-pill success">Overall score</span>
            </div>
            <div className="rev-table-wrap">
              <table className="rev-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Fit</th>
                    <th>Intent</th>
                    <th>Authority</th>
                    <th>Urgency</th>
                    <th>Overall</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.name}>
                      <td>{company.name}</td>
                      <td>{company.fit}</td>
                      <td>{company.intent}</td>
                      <td>{company.authority}</td>
                      <td>{company.urgency}</td>
                      <td><span className="rev-score">{company.score}</span></td>
                      <td>{company.stage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rev-panel">
            <div className="rev-panel-head">
              <div>
                <p className="rev-kicker">AI Workbench</p>
                <h2>Agent Outputs</h2>
              </div>
              <span className="rev-pill">Human approved</span>
            </div>
            <div className="rev-agent-list">
              {agentWork.map((agent) => (
                <div className="rev-agent" key={agent.name}>
                  <div>
                    <b>{agent.name}</b>
                    <span>{agent.output}</span>
                    <small>{agent.proof}</small>
                  </div>
                  <em>{agent.state}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="rev-panel">
            <div className="rev-panel-head">
              <div>
                <p className="rev-kicker">Campaign Builder</p>
                <h2>Healthcare Campaign</h2>
              </div>
              <span className="rev-pill warning">Ready</span>
            </div>
            <div className="rev-automation">
              <div><b>If</b><span>Opened email</span></div>
              <div><b>Then</b><span>Wait 2 days</span></div>
              <div><b>Then</b><span>Send follow-up</span></div>
              <div><b>If</b><span>Clicked</span></div>
              <div><b>Then</b><span>Create task, increase score, notify sales</span></div>
            </div>
          </article>

          <article className="rev-panel rev-wide">
            <div className="rev-panel-head">
              <div>
                <p className="rev-kicker">Customer Portal and Integrations</p>
                <h2>Tickets, Invoices, Projects, Documents, Chat, Renewals</h2>
              </div>
              <span className="rev-pill">10 connected</span>
            </div>
            <div className="rev-integration-grid">
              {integrations.map((integration) => (
                <span key={integration}>{integration}</span>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
