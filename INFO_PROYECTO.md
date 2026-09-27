# ⚡ INFO_PROYECTO: Vita-Trading (By Toni)

> **Ubicación Google Drive:** `Google Drive > Mi unidad > 1-Proyectos > Apps-Desarrollo > Vita-Trading`  
> **Slug / Código:** `mia_vitatrading`  
> **Categoría:** Suite Toni (Propio / I+D)  
> **Estado:** En Producción  
> **Base de Datos:** Supabase PostgreSQL (`mia_vitatrading`)  
> **Directrices Maestras Drive:** [Carpeta de Directrices](https://drive.google.com/drive/folders/1lWPlfQ3KtLijHklYE0O993J-HwQInjZW)

---

## 🎯 1. Propuesta de Valor y Objetivo

**Vita-Trading** es una plataforma profesional de gestión de cuentas de fondeo, backtesting cuantitativo y journal de operaciones con cálculo dinámico de drawdown y métricas de rendimiento para traders.

### 💡 Problema Principal que Resuelve
Control estricto de reglas de empresas de fondeo (trailing drawdown, profit targets) y análisis estadístico de estrategias para evitar pérdidas de cuentas.

### 👥 Público Objetivo
- Toni y traders cuantitativos que gestionan múltiples cuentas de fondeo y brokers.

---

## 🛠️ 2. Arquitectura y Stack Tecnológico

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Lucide Icons.
- **Estilos:** Terminal Dark institucional con alto contraste y diseño financiero.
- **Persistencia:** Supabase PostgreSQL esquema aislado `mia_vitatrading` con RLS estricto.

---

## 📜 3. Cumplimiento de las 5 Directrices Maestras de Google Drive

| # | Directriz | Estado en Vita-Trading |
|---|---|---|
| **1** | **🗄️ Supabase PostgreSQL** | Esquema aislado `mia_vitatrading` con tablas `accounts`, `strategies`, `trades` y RLS activo. |
| **2** | **🛡️ Seguridad & Auth** | Supabase Auth con autenticación y Route Guards. |
| **3** | **🤖 IA & Análisis** | Modelos de predicción y análisis estadístico asistido. |
| **4** | **⚖️ RGPD & Branding** | Titular Antonio Javier García García (DNI 34799350M, Madrid) y sello "By Toni". |
| **5** | **📂 Registro Drive** | Ficha `INFO_PROYECTO.md` registrada. |

---

## 🚀 4. Comandos de Ejecución Local

```bash
cd /Users/toni/Proyectos/Vita-Trading/vita-trading
npm install
npm run dev
```

---
*Ficha generada automáticamente según la Directriz de Registro y Control de Google Drive (By Toni).*
