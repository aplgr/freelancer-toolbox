function replacementApp() {
    return {
        loading: true,
        presets: [],
        selectedPresetFile: "",
        presetLabel: "",
        error: "",
        ok: "",

        // No hardcoded defaults: keep empty until preset loads.
        config: {
            monthsCount: "",
            hoursPerMonth: "",
            externalRateEur: "",
            baselineRateEur: "",
            mentorRateEur: "",
            procurementHours: "",
            extraFixedCostsEur: "",
            valueDelayEnabled: false,
            costOfDelayPerWeekEur: "",
            valueCriticalSharePercent: "",
            months: []
        },

        async init() {
            this.loading = true;
            this.error = "";
            this.ok = "";

            try {
                // presets/index.json format: [{ "label": "...", "file": "presets/xxx.json" }, ...]
                const res = await fetch("presets/index.json", { cache: "no-store" });
                if (!res.ok) throw new Error("Failed to load presets/index.json");

                const idx = await res.json();
                if (!Array.isArray(idx) || idx.length === 0) {
                    throw new Error("presets/index.json is empty or has the wrong format.");
                }

                this.presets = idx;
                this.selectedPresetFile = idx[0].file;
                this.presetLabel = idx[0].label || idx[0].file;

                await this.loadPreset(this.selectedPresetFile);
            } catch (e) {
                this.presets = [];
                this.selectedPresetFile = "";
                this.presetLabel = "";
                this.error = (e && e.message) ? e.message : "Failed to load presets.";
            } finally {
                this.loading = false;
            }
        },

        async loadPreset(file) {
            this.error = "";
            this.ok = "";

            if (!file) return;

            try {
                const res = await fetch(file, { cache: "no-store" });
                if (!res.ok) throw new Error("Failed to load preset: " + file);

                const data = await res.json();
                this.applyConfig(data);

                const p = this.presets.find(x => x.file === file);
                this.presetLabel = p ? (p.label || p.file) : file;

                this.ok = "Preset loaded.";
                setTimeout(() => (this.ok = ""), 1000);
            } catch (e) {
                this.error = (e && e.message) ? e.message : "Failed to load preset.";
            }
        },

        resetToFirstPreset() {
            if (!this.presets.length) return;
            this.selectedPresetFile = this.presets[0].file;
            this.presetLabel = this.presets[0].label || this.presets[0].file;
            this.loadPreset(this.selectedPresetFile);
        },

        applyConfig(data) {
            const safe = (data && typeof data === "object") ? data : {};
            const monthsCount = this.n(safe.monthsCount);
            this.config.monthsCount = monthsCount > 0 ? monthsCount : "";

            this.config.hoursPerMonth = this.toStr(safe.hoursPerMonth);
            this.config.externalRateEur = this.toStr(safe.externalRateEur);
            this.config.baselineRateEur = this.toStr(safe.baselineRateEur);
            this.config.mentorRateEur = this.toStr(safe.mentorRateEur);
            this.config.procurementHours = this.toStr(safe.procurementHours);
            this.config.extraFixedCostsEur = this.toStr(safe.extraFixedCostsEur);

            const incomingMonths = Array.isArray(safe.months) ? safe.months : [];
            this.config.months = incomingMonths.map(m => ({
                productivity: this.toStr(m.productivity),
                mentoringHours: this.toStr(m.mentoringHours),
                note: (m && m.note != null) ? String(m.note) : ""
            }));

            // Ensure months array matches monthsCount
            this.syncMonths();
        },

        syncMonths() {
            const raw = this.n(this.config.monthsCount);
            if (!raw || raw < 1) return; // keep empty until user/preset provides monthsCount

            const target = Math.max(1, Math.floor(raw));
            const current = Array.isArray(this.config.months) ? this.config.months : [];
            const next = current.slice(0, target);

            while (next.length < target) {
                next.push({ productivity: "", mentoringHours: "", note: "" });
            }

            this.config.months = next;
            this.config.monthsCount = target;
        },

        downloadConfigJson() {
            this.error = "";
            this.ok = "";

            try {
                const payload = this.exportPayload();
                const json = JSON.stringify(payload, null, 2);
                const blob = new Blob([json], { type: "application/json" });

                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "replacement-cost-config.json";
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);

                this.ok = "Export created.";
                setTimeout(() => (this.ok = ""), 1000);
            } catch (e) {
                this.error = (e && e.message) ? e.message : "Export failed.";
            }
        },

        async uploadConfigJson(ev) {
            this.error = "";
            this.ok = "";

            const file = ev.target.files && ev.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                this.applyConfig(data);

                this.ok = "Configuration imported.";
                setTimeout(() => (this.ok = ""), 1000);
            } catch (e) {
                this.error = "Import failed: invalid JSON.";
            } finally {
                ev.target.value = "";
            }
        },

        exportPayload() {
            return {
                monthsCount: this.n(this.config.monthsCount),
                hoursPerMonth: this.n(this.config.hoursPerMonth),
                externalRateEur: this.n(this.config.externalRateEur),
                baselineRateEur: this.n(this.config.baselineRateEur),
                mentorRateEur: this.n(this.config.mentorRateEur),
                procurementHours: this.n(this.config.procurementHours),
                extraFixedCostsEur: this.n(this.config.extraFixedCostsEur),
                valueDelayEnabled: !!this.config.valueDelayEnabled,
                costOfDelayPerWeekEur: this.n(this.config.costOfDelayPerWeekEur),
                valueCriticalSharePercent: this.n(this.config.valueCriticalSharePercent),
                months: (this.config.months || []).map(m => ({
                    productivity: this.n(m.productivity),
                    mentoringHours: this.n(m.mentoringHours),
                    note: m.note || ""
                }))
            };
        },

        // ---------- Helpers ----------
        n(v) {
            const x = (v === null || v === undefined || v === "") ? 0 : Number(v);
            return Number.isFinite(x) ? x : 0;
        },

        toStr(v) {
            if (v === null || v === undefined) return "";
            if (typeof v === "number" && Number.isFinite(v)) return String(v);
            if (typeof v === "string") return v;
            return "";
        },

        formatEur(amount) {
            const x = Number.isFinite(amount) ? amount : 0;
            return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(x);
        },

        fmtInt(x) {
            const n = Number(x || 0);
            return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(n);
        },

        fmtDec(x) {
            const n = Number(x || 0);
            return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n);
        },

        fmtPct(x) {
            const n = Number(x || 0);
            return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format(n);
        },


        monthSummary(idx) {
            const m = (this.config.months || [])[idx];
            if (!m) return "";
            const prod = this.n(m.productivity);
            const hrs = this.n(m.mentoringHours);
            return `p=${prod.toFixed(2)} · mentor=${hrs.toFixed(0)}h`;
        },

        // ---------- Calculations ----------
        billedHours() {
            return this.n(this.config.hoursPerMonth) * this.n(this.config.monthsCount);
        },

        externalSpend() {
            return this.n(this.config.externalRateEur) * this.billedHours();
        },

        baselineCost() {
            return this.n(this.config.baselineRateEur) * this.billedHours();
        },

        effectiveHours() {
            const hpm = this.n(this.config.hoursPerMonth);
            const sumProd = (this.config.months || []).reduce((acc, m) => acc + Math.min(1, Math.max(0, this.n(m.productivity))), 0);
            return hpm * sumProd;
        },

        mentoringCost() {
            const rate = this.n(this.config.mentorRateEur);
            const sumMent = (this.config.months || []).reduce((acc, m) => acc + Math.max(0, this.n(m.mentoringHours)), 0);
            return rate * sumMent;
        },

        procurementCost() {
            return this.n(this.config.mentorRateEur) * Math.max(0, this.n(this.config.procurementHours));
        },

        extraFixedCosts() {
            return Math.max(0, this.n(this.config.extraFixedCostsEur));
        },

        totalCost() {
            return this.externalSpend() + this.mentoringCost() + this.procurementCost() + this.extraFixedCosts();
        },

        outputGap() {
            return this.billedHours() - this.effectiveHours();
        },

        outputValueLoss() {
            return Math.max(0, this.outputGap()) * this.n(this.config.baselineRateEur);
        },

        rateDeltaCost() {
            const delta = this.n(this.config.externalRateEur) - this.n(this.config.baselineRateEur);
            return delta * this.billedHours();
        },

        replacementPremium() {
            // Premium includes: rate delta + output loss valued at baseline + internal costs + extra one-offs
            return this.rateDeltaCost() + this.outputValueLoss() + this.mentoringCost() + this.procurementCost() + this.extraFixedCosts();
        },

        valueDelayEnabled() {
            return !!this.config.valueDelayEnabled;
        },

        valueCriticalShare() {
            const p = this.n(this.config.valueCriticalSharePercent);
            return Math.min(1, Math.max(0, p / 100));
        },

        baselineWeeklyHours() {
            // Conservative: 4 weeks per month.
            const hpm = this.n(this.config.hoursPerMonth);
            return hpm / 4;
        },

        estimatedDelayWeeks() {
            if (!this.valueDelayEnabled()) return 0;
            const weekly = this.baselineWeeklyHours();
            if (weekly <= 0) return 0;
            const gap = Math.max(0, this.outputGap());
            return (gap * this.valueCriticalShare()) / weekly;
        },

        valueDelayCost() {
            if (!this.valueDelayEnabled()) return 0;
            const cod = this.n(this.config.costOfDelayPerWeekEur);
            return cod * this.estimatedDelayWeeks();
        },

        totalImpact() {
            return this.replacementPremium() + this.valueDelayCost();
        },


        effectiveCostPerEffHour() {
            const eff = this.effectiveHours();
            if (eff <= 0) return 0;
            return this.totalCost() / eff;
        },

        equivalentCostForFullOutput() {
            const eff = this.effectiveHours();
            const billed = this.billedHours();
            if (eff <= 0) return 0;
            return this.totalCost() * (billed / eff);
        }
    };
}