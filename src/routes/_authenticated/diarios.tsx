import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Check, Copy, Download, Globe, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateJournal,
  useDeleteJournal,
  useJournals,
  useTemplateJournals,
  useToggleTemplate,
  useUpdateJournal,
  type Journal,
} from "@/lib/journals";
import { useJournal } from "@/lib/journal-store";
import { exportAllJournalsCsv, exportJournalCsv, importJournalCsv } from "@/lib/journal-csv";
import { useAuth } from "@/lib/auth-context";
import { createExampleJournal } from "@/lib/example-journal";
import { cloneTemplateJournal } from "@/lib/template-clone";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/diarios")({
  head: () => ({
    meta: [
      { title: "Diarios — Bitácora de Trading" },
      {
        name: "description",
        content: "Crea y gestiona bitácoras independientes con sus cuentas y estrategias.",
      },
      { property: "og:title", content: "Diarios — Bitácora de Trading" },
      {
        property: "og:description",
        content: "Cada diario agrupa sus propias cuentas, estrategias y operaciones.",
      },
    ],
  }),
  component: JournalsPage,
});

function JournalsPage() {
  const { data: journals = [], isLoading } = useJournals();
  const { data: templates = [] } = useTemplateJournals();
  const create = useCreateJournal();
  const update = useUpdateJournal();
  const remove = useDeleteJournal();
  const toggleTemplate = useToggleTemplate();
  const { user } = useAuth();
  const { activeJournalId, setActiveJournalId } = useJournal();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importTarget, setImportTarget] = useState<Journal | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleExample() {
    setBusyId("example");
    try {
      const created = await createExampleJournal();
      await qc.invalidateQueries({ queryKey: ["journals"] });
      setActiveJournalId(created.id);
      toast.success(`Diario de ejemplo creado con datos de muestra`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el diario de ejemplo");
    } finally {
      setBusyId(null);
    }
  }

  async function handleClone(tpl: Journal) {
    const name = prompt("Nombre para tu copia del diario", tpl.name);
    if (!name?.trim()) return;
    setBusyId("clone-" + tpl.id);
    try {
      const created = await cloneTemplateJournal(tpl.id, name.trim());
      await qc.invalidateQueries({ queryKey: ["journals"] });
      await qc.invalidateQueries({ queryKey: ["journal-data"] });
      setActiveJournalId(created.id);
      toast.success(`Diario "${name.trim()}" creado a partir del ejemplo`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo clonar el diario");
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport(j: Journal) {
    setBusyId(j.id);
    try {
      const n = await exportJournalCsv(j.id, j.name);
      toast.success(`Exportados ${n} registros de "${j.name}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setBusyId(null);
    }
  }

  async function handleExportAll() {
    setBusyId("all");
    try {
      const n = await exportAllJournalsCsv(journals);
      toast.success(`Copia completa exportada (${n} registros)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setBusyId(null);
    }
  }

  function pickFile(j: Journal | null) {
    setImportTarget(j);
    fileRef.current?.click();
  }

  async function handleFile(file: File) {
    const targetId = importTarget?.id ?? activeJournalId;
    setBusyId(importTarget?.id ?? "all");
    try {
      const res = await importJournalCsv(targetId, await file.text());
      await qc.invalidateQueries({ queryKey: ["journals"] });
      await qc.invalidateQueries({ queryKey: ["journal-data"] });
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["mood-checkins"] });
      await qc.invalidateQueries({ queryKey: ["journal-rules"] });
      const parts = [
        res.journals ? `${res.journals} diarios` : "",
        res.accounts ? `${res.accounts} cuentas` : "",
        res.strategies ? `${res.strategies} estrategias` : "",
        res.trades ? `${res.trades} operaciones` : "",
        res.withdrawals ? `${res.withdrawals} retiros` : "",
        res.expenses ? `${res.expenses} gastos` : "",
        res.checkins ? `${res.checkins} check-ins` : "",
        res.periods ? `${res.periods} tramos` : "",
      ].filter(Boolean);

      toast.success(
        (parts.length ? `Importado: ${parts.join(", ")}` : "Nada nuevo que importar") +
          (res.duplicates ? ` · ${res.duplicates} duplicados omitidos` : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar el CSV");
    } finally {
      setBusyId(null);
      setImportTarget(null);
    }
  }


  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Journal | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("EUR");

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setCurrency("EUR");
    setOpen(true);
  }

  function openEdit(j: Journal) {
    setEditing(j);
    setName(j.name);
    setDescription(j.description ?? "");
    setCurrency(j.base_currency);
    setOpen(true);
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("El diario necesita un nombre");
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          name: name.trim(),
          description: description.trim() || null,
          base_currency: currency,
        });
        toast.success("Diario actualizado");
      } else {
        const created = await create.mutateAsync({
          name: name.trim(),
          description: description.trim(),
          base_currency: currency,
        });
        setActiveJournalId(created.id);
        toast.success("Diario creado");
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el diario");
    }
  }

  return (
    <AppShell
      title="Diarios"
      subtitle="Bitácoras independientes: cada una con sus cuentas, estrategias y operaciones"
      showAccountPanel={false}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" title="Exportar todo" disabled={busyId === "all"} onClick={handleExportAll}>
            <Download className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            title="Crear diario de ejemplo con datos de muestra"
            disabled={busyId === "example"}
            onClick={handleExample}
          >
            <Sparkles className="size-4" /> Ejemplo
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> Nuevo diario
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando diarios…</p>
      ) : journals.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="text-sm text-muted-foreground">Todavía no tienes diarios.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Crear el primero
            </Button>
            <Button variant="outline" disabled={busyId === "example"} onClick={handleExample}>
              <Sparkles className="size-4" /> Diario de ejemplo
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {journals.map((j) => {
            const active = j.id === activeJournalId;
            return (
              <article
                key={j.id}
                className={cn(
                  "panel flex flex-col gap-3 p-4",
                  active && "ring-1 ring-brand",
                  j.is_archived && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{j.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {j.base_currency} · {new Date(j.created_at).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {active && (
                      <span className="rounded bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">
                        Activo
                      </span>
                    )}
                    {j.is_template && (
                      <span className="rounded bg-profit/15 px-2 py-0.5 text-[11px] font-semibold text-profit">
                        Ejemplo público
                      </span>
                    )}
                  </div>
                </div>
                {j.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{j.description}</p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={active ? "secondary" : "default"}
                    onClick={() => setActiveJournalId(j.id)}
                    disabled={active}
                  >
                    <Check className="size-4" /> {active ? "En uso" : "Usar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(j)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Exportar operaciones a CSV"
                    disabled={busyId === j.id}
                    onClick={() => handleExport(j)}
                  >
                    <Download className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Importar operaciones desde CSV"
                    disabled={busyId === j.id}
                    onClick={() => pickFile(j)}
                  >
                    <Upload className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update.mutate({ id: j.id, is_archived: !j.is_archived })
                    }
                  >
                    {j.is_archived ? (
                      <ArchiveRestore className="size-4" />
                    ) : (
                      <Archive className="size-4" />
                    )}
                  </Button>
                  {j.owner_id === user?.id && (
                    <Button
                      size="sm"
                      variant={j.is_template ? "default" : "outline"}
                      title={
                        j.is_template
                          ? "Quitar de ejemplos públicos"
                          : "Publicar como ejemplo público (clonable por todos)"
                      }
                      disabled={toggleTemplate.isPending}
                      onClick={() =>
                        toggleTemplate.mutate({ id: j.id, value: !j.is_template })
                      }
                    >
                      <Globe className="size-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`¿Eliminar el diario "${j.name}"?`)) remove.mutate(j.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {templates.filter((t) => t.owner_id !== user?.id).length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="size-4 text-profit" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Ejemplos públicos
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates
              .filter((t) => t.owner_id !== user?.id)
              .map((t) => (
                <article key={t.id} className="panel flex flex-col gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t.base_currency} · {new Date(t.created_at).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  {t.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                  )}
                  <div className="mt-auto">
                    <Button
                      size="sm"
                      disabled={busyId === "clone-" + t.id}
                      onClick={() => handleClone(t)}
                    >
                      <Copy className="size-4" /> Clonar diario
                    </Button>
                  </div>
                </article>
              ))}
          </div>
        </section>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void handleFile(f);
        }}
      />

      <p className="mt-4 text-xs text-muted-foreground">
        El CSV incluye todo: diarios, cuentas, estrategias, operaciones y retiros (columna
        <span className="font-mono"> tipo</span>). Al importar se crean los diarios, cuentas y
        estrategias que falten y se omiten los registros ya existentes.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span className="hidden" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar diario" : "Nuevo diario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="j-name">Nombre</Label>
              <Input id="j-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-desc">Descripción</Label>
              <Textarea
                id="j-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-cur">Moneda base</Label>
              <Input
                id="j-cur"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
