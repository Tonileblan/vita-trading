import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Check,
  Copy,
  Download,
  FolderArchive,
  Globe,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CsvRepairDialog } from "@/components/csv-repair-dialog";
import type { CsvRepairResult } from "@/lib/csv-repair.functions";
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
  const [journalToDelete, setJournalToDelete] = useState<Journal | null>(null);

  const activeJournal = journals.find((j) => j.id === activeJournalId);
  const archivedCount = journals.filter((j) => j.is_archived).length;
  const publicTemplates = templates.filter((t) => t.owner_id !== user?.id);

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

  const [isRepairDialogOpen, setIsRepairDialogOpen] = useState(false);
  const [failedCsvText, setFailedCsvText] = useState("");
  const [failedFileName, setFailedFileName] = useState("");
  const [failedErrorDetails, setFailedErrorDetails] = useState("");
  const [repairTargetId, setRepairTargetId] = useState("");

  async function handleFile(file: File) {
    const targetId = importTarget?.id ?? activeJournalId;
    setBusyId(importTarget?.id ?? "all");
    let rawText = "";
    try {
      rawText = await file.text();
      const res = await importJournalCsv(targetId, rawText);
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
    } catch (e: any) {
      const errMsg = e instanceof Error ? e.message : "No se pudo importar el CSV";
      setFailedCsvText(rawText);
      setFailedFileName(file.name);
      setFailedErrorDetails(errMsg);
      setRepairTargetId(targetId);
      setIsRepairDialogOpen(true);

      toast.error(errMsg, {
        action: {
          label: "✨ Arreglar con IA",
          onClick: () => setIsRepairDialogOpen(true),
        },
        duration: 9000,
      });
    } finally {
      setBusyId(null);
      setImportTarget(null);
    }
  }

  async function handleApplyRepaired(result: CsvRepairResult) {
    const targetId = repairTargetId || activeJournalId;
    if (result.repairedCsvText) {
      try {
        const res = await importJournalCsv(targetId, result.repairedCsvText);
        await qc.invalidateQueries({ queryKey: ["journals"] });
        await qc.invalidateQueries({ queryKey: ["journal-data"] });
        await qc.invalidateQueries({ queryKey: ["expenses"] });
        await qc.invalidateQueries({ queryKey: ["mood-checkins"] });
        await qc.invalidateQueries({ queryKey: ["journal-rules"] });
        toast.success(`Importación completada con éxito tras la reparación con IA (${res.trades} operaciones)`);
        return;
      } catch (err: any) {
        console.warn("Fallo al re-importar CSV reparado, procesando trades individuales...", err);
      }
    }

    if (result.trades && result.trades.length > 0) {
      const { data: journalData } = await supabase.from("accounts").select("id, name").eq("journal_id", targetId);
      const accList = journalData ?? [];
      const defaultAccId = accList[0]?.id;

      let importedCount = 0;
      for (const t of result.trades) {
        const matchingAcc = accList.find((a) => a.name.toLowerCase() === t.accountName?.toLowerCase());
        const accId = matchingAcc?.id || defaultAccId;
        if (!accId) continue;

        await supabase.from("trades").insert({
          journal_id: targetId,
          account_id: accId,
          symbol: t.symbol || "MNQ",
          direction: t.direction || "long",
          opened_at: t.openedAt || new Date().toISOString(),
          closed_at: t.closedAt || new Date().toISOString(),
          entry_price: t.entryPrice ?? null,
          exit_price: t.exitPrice ?? null,
          size: t.size ?? 1,
          pnl: t.pnl,
          notes: t.notes ?? null,
        });
        importedCount++;
      }

      await qc.invalidateQueries({ queryKey: ["journals"] });
      await qc.invalidateQueries({ queryKey: ["journal-data"] });
      toast.success(`Se importaron ${importedCount} operaciones reparadas por IA en tu diario`);
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
      title="Diarios de Trading"
      subtitle="Bitácoras independientes: cada una con sus propias cuentas, estrategias y operaciones"
      showAccountPanel={false}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            title="Exportar todo en un único CSV"
            disabled={busyId === "all"}
            onClick={handleExportAll}
            className="gap-1.5"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Exportar todo</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            title="Importar CSV global"
            onClick={() => pickFile(null)}
            className="gap-1.5"
          >
            <Upload className="size-4" />
            <span className="hidden sm:inline">Importar CSV</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            title="Crear diario de ejemplo con datos de muestra"
            disabled={busyId === "example"}
            onClick={handleExample}
            className="gap-1.5"
          >
            <Sparkles className="size-4 text-brand" />
            <span>Ejemplo</span>
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="size-4" />
            <span>Nuevo diario</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <BookOpen className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Diarios</p>
              <p className="text-xl font-bold">{journals.length}</p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Check className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Diario Activo</p>
              <p className="truncate text-sm font-bold text-foreground">
                {activeJournal ? activeJournal.name : "Ninguno"}
              </p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <FolderArchive className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Archivados</p>
              <p className="text-xl font-bold">{archivedCount}</p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <Globe className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plantillas Públicas</p>
              <p className="text-xl font-bold">{templates.length}</p>
            </div>
          </div>
        </div>

        {/* Journals Grid */}
        {isLoading ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Cargando tus diarios…
          </div>
        ) : journals.length === 0 ? (
          <div className="panel p-10 text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <BookOpen className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Todavía no tienes bitácoras</h3>
              <p className="text-sm text-muted-foreground">
                Crea un diario personalizado para empezar a registrar tus cuentas y operaciones, o carga uno de ejemplo.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Button onClick={openCreate} className="gap-1.5">
                <Plus className="size-4" /> Crear mi primer diario
              </Button>
              <Button variant="outline" disabled={busyId === "example"} onClick={handleExample} className="gap-1.5">
                <Sparkles className="size-4 text-brand" /> Cargar diario de ejemplo
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {journals.map((j) => {
              const active = j.id === activeJournalId;
              return (
                <article
                  key={j.id}
                  className={cn(
                    "panel flex flex-col justify-between p-5 transition-all",
                    active
                      ? "border-brand ring-1 ring-brand bg-brand/[0.02]"
                      : "hover:border-foreground/20",
                    j.is_archived && "opacity-60 bg-muted/20",
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-base font-bold text-foreground">{j.name}</h2>
                          {active && (
                            <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
                              En uso
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Moneda: <strong className="text-foreground">{j.base_currency}</strong> · Creado el{" "}
                          {new Date(j.created_at).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {j.is_template && (
                          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                            Público
                          </span>
                        )}
                        {j.is_archived && (
                          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                            Archivado
                          </span>
                        )}
                      </div>
                    </div>

                    {j.description ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {j.description}
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground/60">Sin descripción</p>
                    )}
                  </div>

                  <div className="mt-5 space-y-3 pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant={active ? "secondary" : "default"}
                        onClick={() => setActiveJournalId(j.id)}
                        disabled={active}
                        className="flex-1 gap-1.5"
                      >
                        <Check className="size-4" /> {active ? "Activo" : "Usar este diario"}
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          title="Editar diario"
                          onClick={() => openEdit(j)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          title="Exportar CSV"
                          disabled={busyId === j.id}
                          onClick={() => handleExport(j)}
                        >
                          <Download className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          title="Importar CSV a este diario"
                          disabled={busyId === j.id}
                          onClick={() => pickFile(j)}
                        >
                          <Upload className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          title={j.is_archived ? "Desarchivar" : "Archivar"}
                          onClick={() => update.mutate({ id: j.id, is_archived: !j.is_archived })}
                        >
                          {j.is_archived ? (
                            <ArchiveRestore className="size-3.5" />
                          ) : (
                            <Archive className="size-3.5" />
                          )}
                        </Button>
                        {j.owner_id === user?.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className={cn("size-8", j.is_template && "text-emerald-500")}
                            title={
                              j.is_template
                                ? "Quitar de ejemplos públicos"
                                : "Publicar como plantilla pública"
                            }
                            disabled={toggleTemplate.isPending}
                            onClick={() =>
                              toggleTemplate.mutate({ id: j.id, value: !j.is_template })
                            }
                          >
                            <Globe className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Eliminar diario"
                          onClick={() => setJournalToDelete(j)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Public Templates Section */}
        {publicTemplates.length > 0 && (
          <section className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <Globe className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Plantillas y Ejemplos Públicos de la Comunidad
                </h2>
                <p className="text-xs text-muted-foreground">
                  Clona bitácoras prediseñadas con cuentas y estrategias para tu uso personal.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {publicTemplates.map((t) => (
                <article key={t.id} className="panel flex flex-col justify-between p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-bold">{t.name}</h3>
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {t.base_currency}
                      </span>
                    </div>
                    {t.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    )}
                  </div>
                  <div className="mt-4 pt-2 border-t border-border/60">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 text-xs"
                      disabled={busyId === "clone-" + t.id}
                      onClick={() => handleClone(t)}
                    >
                      <Copy className="size-3.5" /> Clonar en mis diarios
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

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

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span className="hidden" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar diario" : "Crear nuevo diario"}</DialogTitle>
            <DialogDescription>
              Define el nombre, la moneda de referencia y una descripción opcional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="j-name">Nombre del diario</Label>
              <Input
                id="j-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Mi Bitácora Futures 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-desc">Descripción (opcional)</Label>
              <Textarea
                id="j-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve resumen del objetivo o estilo de trading..."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-cur">Moneda base</Label>
              <Input
                id="j-cur"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="EUR, USD, GBP..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              {editing ? "Guardar cambios" : "Crear diario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!journalToDelete} onOpenChange={(o) => !o && setJournalToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el diario "{journalToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el diario junto con todas sus cuentas, estrategias y operaciones asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (journalToDelete) {
                  remove.mutate(journalToDelete.id);
                  setJournalToDelete(null);
                  toast.success("Diario eliminado");
                }
              }}
            >
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reparación asistida de CSV con IA */}
      <CsvRepairDialog
        open={isRepairDialogOpen}
        onOpenChange={setIsRepairDialogOpen}
        rawCsvText={failedCsvText}
        fileName={failedFileName}
        errorDetails={failedErrorDetails}
        context="full_journal"
        onApplyRepaired={handleApplyRepaired}
      />
    </AppShell>
  );
}
