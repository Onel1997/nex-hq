"use client";

import { useMemo, useState } from "react";
import {
  approvalCounts,
  loadReferenceCatalog,
  type ReferenceApprovalStatus,
  type ReferenceBoard,
} from "@/lib/reference-intelligence";
import { Images, Lock } from "lucide-react";

type BoardRow = {
  board: ReferenceBoard;
  counts: Record<ReferenceApprovalStatus, number>;
};

/**
 * Persona Studio foundation for Reference Boards.
 * Seed boards only — no uploads, no vision analysis, no public URLs.
 */
export function ReferenceBoardsPanel() {
  const catalog = useMemo(() => loadReferenceCatalog(), []);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    catalog.boards[0]?.id ?? null,
  );

  const rows: BoardRow[] = useMemo(
    () =>
      catalog.boards.map((board) => ({
        board,
        counts: approvalCounts(catalog, board.id),
      })),
    [catalog],
  );

  const selected = rows.find((r) => r.board.id === selectedBoardId) ?? rows[0];
  const totalApproved = rows.reduce((n, r) => n + r.counts.approved, 0);
  const totalDraft = rows.reduce((n, r) => n + r.counts.draft, 0);

  return (
    <div className="ps-ref-boards">
      <div className="ps-section-label">
        <span>Reference Boards</span>
        <em>
          {totalApproved} approved · {totalDraft} draft
        </em>
      </div>

      <p className="ps-muted ps-ref-boards-lead">
        Abstract visual direction only — never copy images, people, logos, or campaigns.
      </p>

      <ul className="ps-ref-board-list">
        {rows.map(({ board, counts }) => {
          const active = selected?.board.id === board.id;
          return (
            <li key={board.id}>
              <button
                type="button"
                className={`ps-ref-board-item${active ? " is-active" : ""}`}
                onClick={() => setSelectedBoardId(board.id)}
              >
                <strong>{board.name}</strong>
                <span className="ps-ref-board-meta">
                  {board.primaryUsage.replace(/_/g, " ")} · {counts.approved} approved ·{" "}
                  {counts.draft} draft
                </span>
                <span className="ps-ref-board-updated">
                  Updated {board.updatedAt.slice(0, 10)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <div className="ps-ref-board-detail">
          <div className="ps-ref-board-detail-head">
            <Images className="size-3.5" strokeWidth={1.5} aria-hidden />
            <strong>{selected.board.name}</strong>
          </div>
          <p className="ps-muted">{selected.board.description}</p>

          {selected.counts.approved + selected.counts.draft === 0 ? (
            <div className="ps-empty-state ps-empty-state--luxury ps-ref-board-empty">
              <strong>No references yet</strong>
              <p>
                Register abstract casting descriptors manually. Automatic vision analysis is
                disabled.
              </p>
            </div>
          ) : null}

          <div className="ps-ref-board-actions">
            <button type="button" className="ps-btn" disabled title="Coming soon">
              Add Reference
            </button>
            <button type="button" className="ps-btn" disabled title="Coming soon">
              Edit Descriptors
            </button>
            <button type="button" className="ps-btn" disabled title="Coming soon">
              Approve
            </button>
            <button type="button" className="ps-btn" disabled title="Coming soon">
              Reject
            </button>
            <button type="button" className="ps-btn" disabled title="Coming soon">
              Archive
            </button>
          </div>

          <div className="ps-future-card ps-ref-vision-disabled">
            <span>
              <Lock className="size-3 inline" strokeWidth={1.6} aria-hidden /> Automatic analysis
            </span>
            <em>Future · vision models disabled</em>
          </div>
        </div>
      ) : null}
    </div>
  );
}
