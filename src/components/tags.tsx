import { Tag, type Tone } from "./ui";
import {
  CALL_OUTCOME_LABEL, CANDIDATE_STATUS_LABEL, JOB_STATUS_LABEL, REFUND_STATUS_LABEL, STAGE_SHORT,
  type CallOutcome, type CandidateStatus, type Stage,
} from "@/lib/constants";

const STATUS_TONE: Record<CandidateStatus, Tone> = {
  LEAD: "blue", CONTACTED: "plain", INTERESTED: "amber", ENROLLED: "green", IN_PROCESS: "green",
  DEPLOYED: "ink", WITHDRAWN: "faint", REFUSED: "red", NOT_ELIGIBLE: "faint", NOT_INTERESTED: "faint",
};
export function StatusTag({ status }: { status: string }) {
  return <Tag tone={STATUS_TONE[status as CandidateStatus] ?? "plain"}>{CANDIDATE_STATUS_LABEL[status as CandidateStatus] ?? status}</Tag>;
}

export function StageTag({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-muted">—</span>;
  return <Tag tone="plain">{STAGE_SHORT[stage as Stage] ?? stage}</Tag>;
}

const OUTCOME_TONE: Partial<Record<CallOutcome, Tone>> = {
  INTERESTED: "amber", ENROLLED: "green", PAYMENT_RECEIVED: "green", PAYMENT_PROMISED: "blue",
  NOT_INTERESTED: "faint", NOT_ELIGIBLE: "faint", NO_ANSWER: "plain", CALL_BACK: "plain",
};
export function OutcomeTag({ outcome }: { outcome: string }) {
  return <Tag tone={OUTCOME_TONE[outcome as CallOutcome] ?? "plain"}>{CALL_OUTCOME_LABEL[outcome as CallOutcome] ?? outcome}</Tag>;
}

export function JobStatusTag({ status }: { status: string }) {
  const tone: Tone = status === "OPEN" ? "green" : status === "ON_HOLD" ? "amber" : "faint";
  return <Tag tone={tone}>{JOB_STATUS_LABEL[status as keyof typeof JOB_STATUS_LABEL] ?? status}</Tag>;
}

export function RefundTag({ status }: { status: string }) {
  const tone: Tone = status === "PENDING" ? "amber" : status === "APPROVED" ? "blue" : status === "PAID" ? "green" : "faint";
  return <Tag tone={tone}>{REFUND_STATUS_LABEL[status] ?? status}</Tag>;
}
