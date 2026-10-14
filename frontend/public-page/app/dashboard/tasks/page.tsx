'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/app/shared/ui/card';
import { Button } from '@/app/shared/ui/button';
import { Input } from '@/app/shared/ui/input';
import { Skeleton } from '@/app/shared/ui/skeleton';
import { tasksService } from '@/lib/api/services/tasks.service';
import type { TaskItem } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { PageHeader } from '../components/page-header';

export default function TasksPage() {
  const t = useTranslations('app.tasks');

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await tasksService.listTasks();
      setTasks(data.tasks);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    load().finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [load]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await tasksService.createTask(trimmed);
      setTitle('');
      await load();
    } catch {
      toast.error(t('toast.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const completeTask = async (task: TaskItem) => {
    if (task.completed) return;
    try {
      await tasksService.completeTask(task.id);
      await load();
    } catch {
      toast.error(t('toast.completeFailed'));
    }
  };

  const deleteTask = async (task: TaskItem) => {
    try {
      await tasksService.deleteTask(task.id);
      await load();
    } catch {
      toast.error(t('toast.deleteFailed'));
    }
  };

  const remaining = tasks.filter((task) => !task.completed).length;

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card className="enter mb-5 px-5 py-4">
        <form onSubmit={addTask} className="flex items-center gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('placeholder')}
            maxLength={200}
            aria-label={t('placeholder')}
          />
          <Button type="submit" disabled={submitting || !title.trim()}>
            <Plus className="size-4" />
            {t('add')}
          </Button>
        </form>
      </Card>

      <Card className="enter gap-0 py-0" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
            {t('listTitle')}
          </h2>
          {!loading && !loadError && (
            <span className="font-mono text-[11px] text-ink-faint">
              {t('remaining', { count: remaining })}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3 px-5 py-4">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-5 w-60" />
          </div>
        ) : loadError ? (
          <p className="px-5 py-4 text-[13px] text-ink-dim">{t('loadError')}</p>
        ) : tasks.length === 0 ? (
          <p className="px-5 py-6 text-center text-[13px] text-ink-dim">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((task) => (
              <li key={task.id} className="group flex items-center gap-3 px-5 py-3">
                <button
                  onClick={() => completeTask(task)}
                  disabled={task.completed}
                  aria-label={t('complete')}
                  className={cn(
                    'shrink-0 transition-colors',
                    task.completed
                      ? 'cursor-default text-primary'
                      : 'text-ink-faint hover:text-primary',
                  )}
                >
                  {task.completed ? <Check className="size-4" /> : <Circle className="size-4" />}
                </button>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm',
                    task.completed ? 'text-ink-faint line-through' : 'text-ink',
                  )}
                >
                  {task.title}
                </span>
                <button
                  onClick={() => deleteTask(task)}
                  aria-label={t('delete')}
                  className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-[var(--red)] focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
