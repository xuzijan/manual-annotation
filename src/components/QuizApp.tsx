'use client';

import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDatasetReadableRelativePath } from '@/lib/progress-model';

const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

const OPTIONS = [
  { en: 'Domain-Cognitive Polysemy', zh: '领域认知多义性' },
  { en: 'Structural Logic Misalignment', zh: '逻辑结构映射误差' },
  { en: 'Habitual Context Omission', zh: '习惯性语境缺失' },
  { en: 'System Boundary Misconception', zh: '系统边界认知错位' },
  { en: 'Conversational Memory Disalignment', zh: '交互上下文失焦' },
  { en: 'Implicit Constraint Under-specification', zh: '隐式约束说明不足' },
  { en: 'Not Ambiguous', zh: '无歧义 / 纯粹的模型能力不足' },
  { en: 'Other', zh: '其他 / 无法归类' },
];

function splitConversation(text: string) {
  return String(text)
    .split(/\n\n(?=USER:\s|LLM:\s)/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      if (raw.startsWith('USER: ')) return { role: 'USER' as const, content: raw.slice(6) };
      if (raw.startsWith('LLM: ')) return { role: 'LLM' as const, content: raw.slice(5) };
      return { role: 'TEXT' as const, content: raw };
    });
}

function renderMarkdownSafe(md: string) {
  const rawHtml = marked.parse(md ?? '', { gfm: true, breaks: true }) as string;
  return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
}

function ConversationView({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const blocks = useMemo(() => splitConversation(text), [text]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const pres = container.querySelectorAll('pre');
    pres.forEach((pre) => {
      if (pre.parentElement?.classList.contains('code-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'code-wrap';
      pre.parentNode?.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.onclick = async () => {
        const code = pre.innerText || '';
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = 'Copied';
          setTimeout(() => {
            btn.textContent = 'Copy';
          }, 900);
        } catch {
          btn.textContent = 'Failed';
          setTimeout(() => {
            btn.textContent = 'Copy';
          }, 900);
        }
      };
      wrap.appendChild(btn);
    });
  }, [blocks, text]);

  return (
    <div ref={containerRef} className="text-left">
      {blocks.map(({ role, content }, idx) => {
        if (role === 'USER' || role === 'LLM') {
          return (
            <div key={idx} className="msg-card mb-4 last:mb-0">
              <div className="msg-header">
                <span className={`role-badge ${role === 'USER' ? 'text-red-600' : 'text-gray-700'}`}>{role}</span>
              </div>
              <div
                className={`md text-sm leading-relaxed break-words ${role === 'USER' ? 'text-blue-600' : 'text-gray-900'}`}
                dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(content) }}
              />
            </div>
          );
        }
        return (
          <div key={idx} className="msg-card mb-4 last:mb-0">
            <div
              className="md text-sm leading-relaxed text-gray-900 break-words"
              dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(content) }}
            />
          </div>
        );
      })}
    </div>
  );
}

type Question = { id: unknown; text: string };

export function QuizApp() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [pendingSelections, setPendingSelections] = useState<Record<string, number[]>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [respondentNameEn, setRespondentNameEn] = useState('');
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [needsMetadata, setNeedsMetadata] = useState(true);
  const [metadataError, setMetadataError] = useState('');
  const [loading, setLoading] = useState(true);

  const isValidRespondentNameEn = useCallback((name: unknown) => {
    const s = String(name ?? '').trim();
    if (!s) return false;
    return /^[A-Za-z][A-Za-z0-9_-]*(?:\s+[A-Za-z0-9_-]+)*$/.test(s);
  }, []);

  const isValidDatasetId = useCallback((id: unknown) => {
    const n = Number(id);
    return Number.isInteger(n) && n >= 1 && n <= 40;
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const progressRes = await fetch(`${API_BASE}/api/progress`, { credentials: 'same-origin' });
      const progress = await progressRes.json();
      const rName = progress.respondentNameEn ?? '';
      const aDs = progress.activeDatasetId ?? null;
      const dsKey = isValidDatasetId(aDs) ? String(Number(aDs)) : null;
      const dsProgress = dsKey
        ? (progress.datasets?.[dsKey] ?? progress.datasets?.[Number(dsKey)] ?? null)
        : null;
      const ans = dsProgress?.answers ?? {};
      const needMeta = !(isValidRespondentNameEn(rName) && isValidDatasetId(aDs));

      setRespondentNameEn(rName);
      setDatasetId(aDs);
      setAnswers(ans);
      setPendingSelections({});

      if (!needMeta) {
        const qr = await fetch(`${API_BASE}/api/questions`, { credentials: 'same-origin' });
        const qs = await qr.json();
        setQuestions(qs);
        setCurrentIndex(Math.min(dsProgress?.currentIndex ?? 0, Math.max(0, qs.length - 1)));
        setNeedsMetadata(false);
        setIsComplete(
          qs.length > 0 &&
            qs.every(
              (q: Question) =>
                Array.isArray(ans[String(q.id)]) && (ans[String(q.id)] as unknown[]).length > 0
            )
        );
      } else {
        setQuestions([]);
        setCurrentIndex(0);
        setNeedsMetadata(true);
        setIsComplete(false);
      }
    } catch (e) {
      console.warn('API 不可用，使用本地 mock 数据', e);
      const mockQuestions: Question[] = [
        {
          id: 1,
          text: `{\n  "context": "user_query_analysis",\n  "input": "帮我写一个关于量子纠缠的科普文案，要通俗易懂。",\n  "model_output_status": "pending"\n}`,
        },
        { id: 2, text: '{\n  "instruction": "Analyze system logs",\n  "status": "error_detected"\n}' },
      ];
      setQuestions(mockQuestions);
      setCurrentIndex(0);
      setAnswers({});
      setPendingSelections({});
      setRespondentNameEn('');
      setDatasetId(null);
      setNeedsMetadata(true);
      setIsComplete(false);
    } finally {
      setLoading(false);
    }
  }, [isValidDatasetId, isValidRespondentNameEn]);

  useEffect(() => {
    void init();
  }, [init]);

  const submitMetadata = async (name: string, ds: string) => {
    setMetadataError('');
    try {
      const resp = await fetch(`${API_BASE}/api/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ respondentNameEn: name, datasetId: ds }),
      });
      const data = (await resp.json()) as { progress?: Record<string, unknown>; error?: string };
      if (!resp.ok) {
        if (resp.status === 401) {
          setMetadataError('请先登录后再试（会话可能已过期）。');
        } else {
          setMetadataError(
            data?.error
              ? `保存失败：${data.error}`
              : '保存失败：请检查英文名与数据集编号（1-40），并确保服务端已启动。'
          );
        }
        return;
      }
      const progress = data?.progress ?? {};
      const rName = (progress.respondentNameEn as string) ?? name;
      const aDs = (progress.activeDatasetId as number) ?? Number(ds);
      const dsKey = isValidDatasetId(aDs) ? String(Number(aDs)) : null;
      const dsProgress = dsKey
        ? ((progress.datasets as Record<string, { answers?: unknown; currentIndex?: number }>)?.[dsKey] ?? null)
        : null;

      const ans = (dsProgress?.answers as Record<string, unknown>) ?? {};
      setRespondentNameEn(rName);
      setDatasetId(aDs);
      setAnswers(ans);
      setPendingSelections({});
      setNeedsMetadata(false);

      const qr = await fetch(`${API_BASE}/api/questions`, { credentials: 'same-origin' });
      const qs = await qr.json();
      setQuestions(qs);
      const ci = Math.min(dsProgress?.currentIndex ?? 0, Math.max(0, qs.length - 1));
      setCurrentIndex(ci);
      setIsComplete(
        qs.length > 0 &&
          qs.every(
            (q: Question) =>
              Array.isArray(ans[String(q.id)]) && (ans[String(q.id)] as unknown[]).length > 0
          )
      );
    } catch {
      setMetadataError('保存失败：网络或服务异常，请稍后重试。');
    }
  };

  const openMetadata = () => {
    setNeedsMetadata(true);
    setIsComplete(false);
  };

  const selectOption = (optionIndex: number) => {
    if (needsMetadata || isComplete) return;
    const question = questions[currentIndex];
    if (!question) return;
    const questionId = String(question.id);
    const curr = new Set<number>(
      (pendingSelections[questionId] as number[] | undefined) ??
        (answers[questionId] as number[] | undefined) ??
        []
    );
    if (curr.has(optionIndex)) curr.delete(optionIndex);
    else curr.add(optionIndex);
    setPendingSelections((p) => ({
      ...p,
      [questionId]: Array.from(curr).sort((a, b) => a - b),
    }));
  };

  const confirmAnswer = async () => {
    if (needsMetadata || isComplete) return;
    const question = questions[currentIndex];
    if (!question) return;
    const questionId = String(question.id);
    const selected =
      (pendingSelections[questionId] as number[] | undefined) ?? (answers[questionId] as number[] | undefined) ?? [];
    if (!Array.isArray(selected) || selected.length === 0) return;

    const nextAnswers = { ...answers, [questionId]: selected };
    setAnswers(nextAnswers);
    try {
      await fetch(`${API_BASE}/api/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ questionId: question.id, answer: selected }),
      });
    } catch (e) {
      console.warn('保存答案失败', e);
    }

    const nextIdx = currentIndex + 1;
    if (nextIdx >= questions.length) {
      setIsComplete(true);
    } else {
      setCurrentIndex(nextIdx);
    }
  };

  const nextQuestion = () => {
    if (needsMetadata) return;
    if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1);
    else setIsComplete(true);
  };

  const prevQuestion = () => {
    if (needsMetadata) return;
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const question = questions[currentIndex];
  const progressPercent = questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const pendingForQuestion =
    question &&
    ((pendingSelections[String(question.id)] as number[] | undefined) ??
      (answers[String(question.id)] as number[] | undefined) ??
      []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        加载中…
      </div>
    );
  }

  if (needsMetadata) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center relative px-4 bg-[#F9FAFB] text-[#111827] overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
          <div className="h-full bg-black transition-all duration-500" style={{ width: '0%' }} />
        </div>
        <main className="w-full max-w-[900px] mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 shadow-sm">
            <div className="mb-6">
              <h1 className="text-3xl font-light tracking-wide text-gray-900">信息统计</h1>
              <p className="text-sm text-gray-500 mt-2">进入第一题前，请先填写问卷回答者信息并选择数据集编号（1-40）。</p>
            </div>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = String(fd.get('respondentNameEn') ?? '');
                const ds = String(fd.get('datasetId') ?? '');
                void submitMetadata(name, ds);
              }}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="respondent-name-en">
                  问卷回答者英文名称
                </label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-black focus:ring-black"
                  id="respondent-name-en"
                  name="respondentNameEn"
                  placeholder="e.g. Alice Zhang"
                  autoComplete="off"
                  required
                  defaultValue={respondentNameEn}
                />
                <p className="text-xs text-gray-500 mt-2">仅允许英文开头，可包含数字、空格、下划线、短横线。</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="dataset-id">
                  选择要做的数据集编号
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-black focus:ring-black"
                  id="dataset-id"
                  name="datasetId"
                  required
                  defaultValue={isValidDatasetId(datasetId) ? String(datasetId) : ''}
                >
                  <option value="" disabled>
                    请选择 1 - 40
                  </option>
                  {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex items-center justify-between gap-4">
                <div className="text-sm text-red-600 min-h-[20px]">{metadataError}</div>
                <button
                  className="inline-flex items-center justify-center rounded-lg bg-black text-white px-5 py-2.5 text-sm hover:bg-gray-900 transition-colors"
                  type="submit"
                >
                  开始答题
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  if (questions.length === 0) {
    const rel = getDatasetReadableRelativePath(datasetId);
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F9FAFB] text-[#111827] px-4">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <h1 className="text-xl font-medium text-amber-900">当前数据集暂无题目</h1>
          <p className="mt-3 text-sm leading-relaxed text-amber-900/90">
            服务端未在仓库根目录找到对应题库 JSON（与 Mongo 无关）。请将数据集文件放到本机/服务器上的项目根目录，文件名需与编号一致，例如：
          </p>
          <code className="mt-4 block rounded-lg bg-white px-3 py-2 text-sm text-gray-800 break-all border border-amber-100">
            {rel ?? 'readable/dataNN.json'}
          </code>
          <p className="mt-4 text-xs text-amber-800/80">
            放置后无需改代码，刷新页面或重新「开始答题」即可加载题目。
          </p>
          <button
            type="button"
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm text-gray-900 hover:border-black transition-colors"
            onClick={openMetadata}
          >
            返回信息统计
          </button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F9FAFB] text-[#111827]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
          <div className="h-full bg-black transition-all duration-500" style={{ width: '100%' }} />
        </div>
        <h1 className="text-5xl font-light tracking-widest text-gray-900">感谢作答</h1>
        <div className="mt-8">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 px-5 py-2.5 text-sm hover:border-black transition-colors"
            onClick={openMetadata}
          >
            继续做其他数据集
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative px-4 bg-[#F9FAFB] text-[#111827] overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
        <div className="h-full bg-black transition-all duration-500" style={{ width: `${progressPercent}%` }} />
      </div>

      <nav className="absolute top-12 left-0 w-full px-12 flex justify-between items-center pointer-events-none">
        <button
          type="button"
          aria-label="上一题"
          className="pointer-events-auto p-2 text-gray-400 hover:text-black transition-colors duration-300 disabled:opacity-0"
          style={{ visibility: currentIndex === 0 ? 'hidden' : 'visible' }}
          onClick={prevQuestion}
        >
          <svg fill="none" height="24" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="24">
            <path d="M15.75 19.5L8.25 12l7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className="pointer-events-auto text-xs tracking-wider text-gray-400 hover:text-black transition-colors duration-300"
          onClick={openMetadata}
        >
          切换数据集
        </button>
        <button
          type="button"
          aria-label="下一题"
          className="pointer-events-auto p-2 text-gray-400 hover:text-black transition-colors duration-300"
          onClick={nextQuestion}
        >
          <svg fill="none" height="24" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="24">
            <path d="M8.25 4.5l7.5 7.5-7.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </nav>

      <main className="w-full max-w-[1400px] flex flex-col items-center">
        <div className="mb-10 text-center transition-all duration-500 w-full px-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 md:p-8 w-full max-w-[1200px] mx-auto shadow-sm max-h-[60vh] overflow-y-auto">
            {question ? <ConversationView text={question.text} /> : null}
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-nowrap justify-center gap-4 flex-wrap">
            {OPTIONS.slice(0, 4).map((opt, idx) => {
              const selectedSet = new Set(pendingForQuestion as number[]);
              const isSelected = selectedSet.has(idx);
              return (
                <button
                  type="button"
                  key={opt.en}
                  className={`group flex items-center justify-between gap-3 p-3 border rounded-lg transition-all duration-200 text-left w-[360px] h-[80px] ${
                    isSelected
                      ? 'bg-black border-black text-white shadow-lg scale-[1.02]'
                      : 'bg-white border-gray-200 hover:border-black hover:bg-gray-50'
                  }`}
                  onClick={() => selectOption(idx)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 border rounded-sm flex items-center justify-center ${
                          isSelected ? 'bg-white text-black border-black' : 'bg-white border-gray-400'
                        }`}
                      >
                        {isSelected ? '✓' : ''}
                      </span>
                      <span
                        className={`text-[11px] uppercase tracking-wider font-medium ${
                          isSelected ? 'text-gray-300' : 'text-black'
                        }`}
                      >
                        {opt.en}
                      </span>
                    </div>
                    <div className={`text-xs font-normal ${isSelected ? 'text-white' : 'text-gray-500'}`}>{opt.zh}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-nowrap justify-center gap-4 flex-wrap">
            {OPTIONS.slice(4).map((opt, idx) => {
              const realIdx = idx + 4;
              const selectedSet = new Set(pendingForQuestion as number[]);
              const isSelected = selectedSet.has(realIdx);
              return (
                <button
                  type="button"
                  key={opt.en}
                  className={`group flex items-center justify-between gap-3 p-3 border rounded-lg transition-all duration-200 text-left w-[360px] h-[80px] ${
                    isSelected
                      ? 'bg-black border-black text-white shadow-lg scale-[1.02]'
                      : 'bg-white border-gray-200 hover:border-black hover:bg-gray-50'
                  }`}
                  onClick={() => selectOption(realIdx)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 border rounded-sm flex items-center justify-center ${
                          isSelected ? 'bg-white text-black border-black' : 'bg-white border-gray-400'
                        }`}
                      >
                        {isSelected ? '✓' : ''}
                      </span>
                      <span
                        className={`text-[11px] uppercase tracking-wider font-medium ${
                          isSelected ? 'text-gray-300' : 'text-black'
                        }`}
                      >
                        {opt.en}
                      </span>
                    </div>
                    <div className={`text-xs font-normal ${isSelected ? 'text-white' : 'text-gray-500'}`}>{opt.zh}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center mt-4">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-black text-white px-5 py-2.5 text-sm hover:bg-gray-900 transition-colors disabled:opacity-50"
            onClick={() => void confirmAnswer()}
            disabled={!Array.isArray(pendingForQuestion) || (pendingForQuestion as number[]).length === 0}
          >
            确认答案
          </button>
        </div>
      </main>
    </div>
  );
}
