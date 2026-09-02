let meta = #{
    name: "gmail-clone-mvp",
    description: "Finish an authentic Gmail clone MVP with core mail logic, Refero-informed UI, and shadcn/ui default theme",
    when_to_use: "Finish or rebuild the Gmail clone MVP in this repo",
    phases: [
        #{ title: "Research", detail: "Audit the current clone and Gmail mailbox rules" },
        #{ title: "Domain", detail: "Implement the mail store and Gmail label rules" },
        #{ title: "Interface", detail: "Rebuild the UI with shadcn primitives" },
        #{ title: "Verify", detail: "Build, logic, and authenticity checks" },
        #{ title: "Polish", detail: "Close remaining gaps" },
    ],
};

fn agent_text(r) {
    if r == () { return ""; }
    if r.success != true { return ""; }
    if type_of(r.output) == "string" { return r.output; }
    json_encode(r.output)
}

let workspace = "/home/jack/workspace/gmail-clone";

phase("Research");
log("Auditing the current clone and Gmail mailbox rules");

let audit_prompt = "";
audit_prompt += "You are researching a Next.js Gmail clone at " + workspace + ". ";
audit_prompt += "Use read_file, list_dir, and grep. Do not edit files. ";
audit_prompt += "Read package.json, components.json, app/layout.tsx, app/page.tsx, app/globals.css, ";
audit_prompt += "components/gmail-clone.tsx, components/ui/button.tsx, and lib/utils.ts. ";
audit_prompt += "Return a concise report covering: (1) current architecture, ";
audit_prompt += "(2) fake or broken business logic with file evidence, ";
audit_prompt += "(3) which shadcn primitives are already installed, ";
audit_prompt += "(4) theme tokens already in globals.css. ";
audit_prompt += "Do not invent files you did not read.";

let logic_prompt = "";
logic_prompt += "Write a precise Gmail mailbox-rules spec for a client-side MVP. ";
logic_prompt += "Cover conversations vs messages, system labels (INBOX STARRED SNOOZED SENT DRAFT SPAM TRASH IMPORTANT UNREAD CATEGORY_*), ";
logic_prompt += "user labels, All Mail, archive vs delete vs spam, star, snooze until, compose/send/draft autosave, ";
logic_prompt += "reply/reply-all/forward, mark read/unread, search operators (from to subject is:unread is:starred has:attachment in:inbox label:), ";
logic_prompt += "bulk select, undo snackbar, category tabs on Inbox only, and empty states. ";
logic_prompt += "State invariants clearly. This is for implementers, not marketing copy.";

let research = parallel([
    #{ prompt: audit_prompt, label: "audit-codebase", capability_mode: "read-only" },
    #{ prompt: logic_prompt, label: "gmail-logic", capability_mode: "read-only" },
]);

let audit_text = "";
let logic_text = "";
if research.len() > 0 { audit_text = agent_text(research[0]); }
if research.len() > 1 { logic_text = agent_text(research[1]); }
log("Research complete");

phase("Domain");
log("Implementing the mail domain store");

let domain_prompt = "";
domain_prompt += "Implement Gmail core business logic in the Next.js app at " + workspace + ". ";
domain_prompt += "Use read_file, grep, and list_dir first. Then write real TypeScript. capability: all.\n\n";
domain_prompt += "CURRENT CLONE BUGS (must replace, not patch in place):\n";
domain_prompt += "- Folder filters are hardcoded (Drafts=id 5, Sent=id 2).\n";
domain_prompt += "- Archive/delete splice messages out of a flat array instead of applying labels.\n";
domain_prompt += "- Compose Send only toasts; it does not create a Sent conversation.\n";
domain_prompt += "- Drafts, Snoozed, Spam, Trash, All Mail, Important, and user labels do not work.\n";
domain_prompt += "- Unread counts, pagination, and message bodies are fake.\n";
domain_prompt += "- There are no threads; everything is a single MailItem.\n\n";
domain_prompt += "RESEARCH AUDIT:\n" + json_encode(audit_text) + "\n\n";
domain_prompt += "GMAIL RULES SPEC:\n" + json_encode(logic_text) + "\n\n";
domain_prompt += "IMPLEMENT THIS MODEL:\n";
domain_prompt += "Gmail is label-based. A Conversation has many Messages. List views show conversations.\n";
domain_prompt += "System labels: INBOX, STARRED, SNOOZED, SENT, DRAFT, SPAM, TRASH, IMPORTANT, UNREAD, ";
domain_prompt += "CATEGORY_PERSONAL, CATEGORY_SOCIAL, CATEGORY_PROMOTIONS, CATEGORY_UPDATES, CATEGORY_FORUMS.\n";
domain_prompt += "User labels: Work, Travel, Receipts (seeded) plus create/apply.\n";
domain_prompt += "INVARIANTS:\n";
domain_prompt += "- Archive: remove INBOX; conversation stays in All Mail unless it is only TRASH/SPAM.\n";
domain_prompt += "- Delete: add TRASH, remove INBOX/SPAM; conversation appears in Trash; can restore to Inbox.\n";
domain_prompt += "- Permanent delete only from Trash.\n";
domain_prompt += "- Report spam: add SPAM, remove INBOX; Not spam restores INBOX and removes SPAM.\n";
domain_prompt += "- Star toggles STARRED independently of folder.\n";
domain_prompt += "- Snooze: remove INBOX, add SNOOZED with snoozedUntil ISO timestamp. ";
domain_prompt += "When now >= snoozedUntil (evaluate on store read/select), remove SNOOZED and add INBOX.\n";
domain_prompt += "- Send: new Message with SENT. If To includes the current user, also INBOX + CATEGORY_PERSONAL.\n";
domain_prompt += "- Reply/Reply all append a Message to the same conversation. Forward starts a new conversation with SENT.\n";
domain_prompt += "- Draft autosave: DRAFT label, listed in Drafts, discarded on trash, converted on send.\n";
domain_prompt += "- Unread: conversation is unread if any message is unread. Opening a thread marks its messages read.\n";
domain_prompt += "- Inbox tabs filter CATEGORY_* and only apply while viewing Inbox.\n";
domain_prompt += "- All Mail: every conversation except those with TRASH or SPAM.\n";
domain_prompt += "- Search operators: from:, to:, subject:, is:unread, is:starred, is:important, has:attachment, in:<folder>, label:<name>, plus free text.\n";
domain_prompt += "- Every mutating action (archive, delete, spam, send, snooze) records an undo snapshot for ~5s.\n";
domain_prompt += "- Current user: Jordan Davis <jordan@studio.co>.\n\n";
domain_prompt += "FILES TO CREATE (do not dump everything into gmail-clone.tsx):\n";
domain_prompt += "lib/mail/types.ts, lib/mail/labels.ts, lib/mail/search.ts, lib/mail/selectors.ts, ";
domain_prompt += "lib/mail/reducer.ts, lib/mail/seed.ts, lib/mail/store.tsx, lib/mail/index.ts.\n";
domain_prompt += "Seed at least 16 conversations covering Primary/Social/Promotions/Updates, a 3-message thread, ";
domain_prompt += "starred, snoozed (future timestamp), draft, sent, spam, trash, attachment flag, and user labels.\n";
domain_prompt += "Persist mailbox JSON in localStorage key gmail-clone.mailbox.v1. Provide reset-to-seed.\n";
domain_prompt += "Export MailProvider + useMail() with: view, category, query, selectedIds, openId, compose, ";
domain_prompt += "visibleConversations, folderCounts, actions (select, star, archive, trash, spam, snooze, ";
domain_prompt += "markRead, applyLabel, send, saveDraft, discardDraft, reply, forward, undo, open, setView, setQuery).\n";
domain_prompt += "Keep functions pure in reducer/search/selectors so they are easy to verify.\n";
domain_prompt += "Do not install extra UI libraries. Do not change the default shadcn theme tokens in globals.css.\n";
domain_prompt += "After writing, run a TypeScript check if possible. Return the files you created and how to use the store.";

let domain = agent(domain_prompt, #{ label: "mail-domain", capability_mode: "all" });
let domain_text = agent_text(domain);
if domain == () || domain.success != true {
    log("Domain agent did not succeed; UI agent must still create lib/mail");
} else {
    log("Domain store written");
}

phase("Interface");
log("Rebuilding the Gmail UI with shadcn/ui primitives");

let ui_prompt = "";
ui_prompt += "Rebuild the authentic Gmail-clone UI in " + workspace + ". ";
ui_prompt += "Use read_file/grep first. Then implement. capability: all.\n\n";
ui_prompt += "DOMAIN AGENT OUTPUT:\n" + json_encode(domain_text) + "\n\n";
ui_prompt += "CONSTRAINTS (non-negotiable):\n";
ui_prompt += "1. Must use shadcn/ui primitives. Install missing ones with: ";
ui_prompt += "pnpm dlx shadcn@latest add input textarea checkbox dropdown-menu dialog sheet tabs tooltip avatar badge separator scroll-area command popover switch select sonner kbd label toggle toggle-group context-menu collapsible --yes\n";
ui_prompt += "2. Start from the existing default theme in app/globals.css (neutral CSS variables). ";
ui_prompt += "Do NOT restyle :root/--primary to Gmail red/blue. Layout and interaction must feel like Gmail; color tokens stay shadcn default.\n";
ui_prompt += "3. Wire every control to the real mail store in lib/mail. No hardcoded folder ids. No toast-only fake actions.\n";
ui_prompt += "4. Replace components/gmail-clone.tsx (or split into components/mail/* and keep a thin GmailClone export). app/page.tsx should render the full app.\n";
ui_prompt += "5. Client-side only is fine. Next.js App Router.\n\n";
ui_prompt += "REFERO DESIGN REFERENCES (apply these product patterns, not their brand colors):\n";
ui_prompt += "- Skiff Mail inbox (screen bcd7737d / a4fddfcb, flow 1887 delete, 1894 label, 1895 reply): ";
ui_prompt += "left folder nav with unread badges; Compose; list rows with checkbox, avatar, sender, subject — snippet, timestamp; ";
ui_prompt += "selection reveals a toolbar (archive/trash/mark read); empty state centered in the pane; ";
ui_prompt += "thread view as stacked message cards with Reply / Reply all / Forward; toast 'Message sent' with Undo; ";
ui_prompt += "create-label modal with name + color then tag on the thread.\n";
ui_prompt += "- Missive (screen 0fcb86ea / fd510527, flow 6281 snooze): three-region mail shell; ";
ui_prompt += "search field in the header; snooze popover with presets and keyboard hints; checkboxes on the list.\n";
ui_prompt += "- Skiff compose (screen c84f04a3): floating New message card with To + Cc/Bcc, subject, body, Send, attach.\n";
ui_prompt += "GMAIL-SPECIFIC SHELL (must match Gmail, not a generic three-column helpdesk):\n";
ui_prompt += "- Left: Gmail-style wordmark 'Gmail' (not a generic Mail logo), hamburger, prominent rounded Compose, ";
ui_prompt += "folders Inbox (unread count), Starred, Snoozed, Sent, Drafts (count if >0), More revealing Important, All Mail, Spam, Trash; Labels section.\n";
ui_prompt += "- Header: rounded Search mail field spanning center, with a search-options popover (from/to/subject/has attachment). Help, Settings, Google apps grid, avatar.\n";
ui_prompt += "- Inbox category tabs: Primary, Social, Promotions, Updates with unread dots. Tabs only on Inbox list view.\n";
ui_prompt += "- List row: checkbox, star, important marker, sender (bold if unread), subject — preview, label chips, attachment icon, date. Hover row actions: archive, delete, mark unread, snooze.\n";
ui_prompt += "- Conversation view replaces the list (Gmail default, not a persistent right pane on mobile). Back arrow, subject, toolbar, stacked messages, inline reply.\n";
ui_prompt += "- Compose docks bottom-right as a card: New Message, minimize / full screen / close. Close with content saves a Draft. Discard removes it. Send uses the store.\n";
ui_prompt += "- Snackbar/sonner with Undo for archive, delete, spam, send, snooze.\n";
ui_prompt += "- Keyboard: c compose, e archive, # delete, s star, r reply, f forward, / search, u back, j/k next prev, Esc close.\n";
ui_prompt += "- Settings popover: density (comfortable/default/compact) using shadcn tokens only.\n";
ui_prompt += "- Responsive: sidebar overlay on small screens; compose full-width on mobile.\n";
ui_prompt += "- Accessible names on icon buttons. Use lucide-react icons.\n";
ui_prompt += "After UI is wired, run pnpm exec tsc --noEmit if available and fix type errors you introduced. ";
ui_prompt += "Do not leave placeholder TODOs for required MVP behavior. Return files changed and how to try the flows.";

let ui = agent(ui_prompt, #{ label: "gmail-ui", capability_mode: "all" });
let ui_text = agent_text(ui);
if ui == () || ui.success != true {
    log("UI agent did not succeed");
} else {
    log("UI rebuilt");
}

phase("Verify");
log("Verifying build, mailbox logic, and Gmail authenticity");

let build_prompt = "";
build_prompt += "In " + workspace + ", install deps if needed, then run the production build. ";
build_prompt += "Commands: pnpm install, then pnpm exec tsc --noEmit, then pnpm build. ";
build_prompt += "If TypeScript or the build fails, fix the errors in source files (do not silence them by expanding ignoreBuildErrors). ";
build_prompt += "next.config.mjs currently has typescript.ignoreBuildErrors: true — leave it unless you can turn it off after a clean tsc. ";
build_prompt += "Report exact command output summaries and whether the app builds.";

let logic_verify_prompt = "";
logic_verify_prompt += "Adversarially verify Gmail business logic in " + workspace + ". Use grep and read_file. Do not trust agent claims. ";
logic_verify_prompt += "Confirm with file evidence that: archive does not destroy conversations; trash is a label; spam is a label; ";
logic_verify_prompt += "sent mail is created on Send; drafts persist; snooze has a timestamp and returns to Inbox; ";
logic_verify_prompt += "search operators work; category tabs filter Inbox; folder counts are derived; undo exists; ";
logic_verify_prompt += "threads have multiple messages. List each missing invariant with file:line evidence. ";
logic_verify_prompt += "An empty issue list is valid only after you have read lib/mail/* and the UI action handlers.";

let ui_verify_prompt = "";
ui_verify_prompt += "Adversarially verify the Gmail-clone UI in " + workspace + ". Use grep and read_file. ";
ui_verify_prompt += "Check: shadcn primitives are actually imported from @/components/ui/* (not one-off HTML that only copies look); ";
ui_verify_prompt += "default theme tokens in globals.css were not replaced with a custom Gmail palette; ";
ui_verify_prompt += "shell has Gmail folders, category tabs, floating compose, thread view, search, snooze, labels, undo; ";
ui_verify_prompt += "no remaining hardcoded Drafts=id 5 / Sent=id 2 filters; empty states exist. ";
ui_verify_prompt += "List concrete gaps with file:line evidence.";

let verify = parallel([
    #{ prompt: build_prompt, label: "verify-build", capability_mode: "all" },
    #{ prompt: logic_verify_prompt, label: "verify-logic", capability_mode: "read-only" },
    #{ prompt: ui_verify_prompt, label: "verify-ui", capability_mode: "read-only" },
]);

let build_text = "";
let logic_v_text = "";
let ui_v_text = "";
if verify.len() > 0 { build_text = agent_text(verify[0]); }
if verify.len() > 1 { logic_v_text = agent_text(verify[1]); }
if verify.len() > 2 { ui_v_text = agent_text(verify[2]); }
log("Verification complete");

phase("Polish");
log("Closing remaining gaps");

let polish_prompt = "";
polish_prompt += "Finish the Gmail clone MVP at " + workspace + ". Read the current code, then fix every real gap below. capability: all.\n\n";
polish_prompt += "UI AGENT OUTPUT:\n" + json_encode(ui_text) + "\n\n";
polish_prompt += "BUILD VERIFY:\n" + json_encode(build_text) + "\n\n";
polish_prompt += "LOGIC VERIFY:\n" + json_encode(logic_v_text) + "\n\n";
polish_prompt += "UI VERIFY:\n" + json_encode(ui_v_text) + "\n\n";
polish_prompt += "Fix failing types/build first, then missing Gmail rules, then UI authenticity. ";
polish_prompt += "Keep shadcn/ui primitives and the default theme. ";
polish_prompt += "Do not add marketing fluff or a new color system. ";
polish_prompt += "After fixes, re-run pnpm exec tsc --noEmit and pnpm build. ";
polish_prompt += "Return a short changelog of what you actually changed.";

let polish = agent(polish_prompt, #{ label: "polish", capability_mode: "all" });
let polish_text = agent_text(polish);

let report = "";
report += "# Gmail clone MVP workflow\n\n";
report += "## Domain\n" + domain_text + "\n\n";
report += "## Interface\n" + ui_text + "\n\n";
report += "## Build\n" + build_text + "\n\n";
report += "## Logic verification\n" + logic_v_text + "\n\n";
report += "## UI verification\n" + ui_v_text + "\n\n";
report += "## Polish\n" + polish_text + "\n";

let path = write_scratch_file("gmail-clone-mvp.md", report);
complete(#{
    path: path,
    summary: "Finished Gmail clone MVP workflow: domain store, shadcn UI, verify, polish.",
});
