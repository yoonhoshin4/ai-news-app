"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteCategory, renameCategory } from "@/app/dashboard/actions";
import { PendingSpinner } from "./pending-spinner";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

const idle =
  "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";
const active =
  "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500";

type Props = {
  href: string;
  label: string;
  count: number;
  active: boolean;
  /** 사용자 카테고리만 이름 변경·삭제 가능 (전체/미분류는 불가) */
  categoryId?: number;
};

export function CategoryChip({ href, label, count, active: isActive, categoryId }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(label);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // 메뉴 바깥을 누르거나 Esc를 누르면 닫는다.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function stopRenaming() {
    setRenaming(false);
    setName(label);
    setError(null);
  }

  function submitRename() {
    if (categoryId === undefined) return;
    if (name.trim() === label) return stopRenaming();
    startTransition(async () => {
      const result = await renameCategory(categoryId, name);
      if (result.ok) setRenaming(false);
      else setError(result.error);
    });
  }

  function remove() {
    if (categoryId === undefined) return;
    setMenuOpen(false);
    const ok = window.confirm(
      `'${label}' 카테고리를 삭제할까요?\n이 카테고리의 뉴스는 '미분류'로 이동합니다.`,
    );
    if (!ok) return;
    startTransition(async () => {
      await deleteCategory(categoryId);
      if (isActive) router.replace("/dashboard"); // 사라진 카테고리 화면에 머물지 않게
    });
  }

  if (renaming) {
    return (
      <div className="flex flex-col gap-1">
        <input
          autoFocus
          value={name}
          disabled={pending}
          maxLength={30}
          aria-label={`'${label}' 새 이름`}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") submitRename();
            if (e.key === "Escape") stopRenaming();
          }}
          onBlur={() => {
            if (!pending) stopRenaming();
          }}
          className={`min-h-9 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 ${focusRing}`}
        />
        {error && (
          <p role="alert" className="px-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`inline-flex min-h-9 items-center rounded-full border text-sm font-medium transition-colors ${
          isActive ? active : idle
        } ${pending ? "opacity-60" : ""}`}
      >
        <Link
          href={href}
          aria-current={isActive ? "true" : undefined}
          className={`inline-flex min-h-9 items-center rounded-full pl-4 ${
            categoryId === undefined ? "pr-4" : "pr-1"
          } ${focusRing}`}
        >
          {label}
          <span
            aria-label={`${count}건`}
            className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
              isActive
                ? "bg-white/25 text-white"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {count}
          </span>
          <PendingSpinner />
        </Link>
        {categoryId !== undefined && (
          <button
            type="button"
            aria-label={`'${label}' 카테고리 관리`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-full ${focusRing}`}
          >
            <span aria-hidden>⋯</span>
          </button>
        )}
      </div>

      {menuOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-md dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setRenaming(true);
            }}
            className="flex min-h-9 w-full items-center px-3 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            이름 변경
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={remove}
            className="flex min-h-9 w-full items-center px-3 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
