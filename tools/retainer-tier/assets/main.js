function RetainerTierApp() {
    return {
        // Mode switches
        unitType: "hours",  // "hours" | "days"
        period: "month",    // "month" | "week"
        baseRate: 60,

        // Planning baselines (only for capacity %)
        fullTimeHoursPerMonth: 160,
        fullTimeDaysPerMonth: 20,

        // Scoring preference
        preference: "stability", // "stability" | "flexibility"

        // Status
        error: "",
        ok: "",

        // Tier list
        tiers: [
            { id: crypto.randomUUID(), name: "Core", units: 40, discount: 10, overageMultiplier: 1.25, termMonths: 3, noticeWeeks: 4 },
            { id: crypto.randomUUID(), name: "Growth", units: 80, discount: 15, overageMultiplier: 1.20, termMonths: 6, noticeWeeks: 6 },
            { id: crypto.randomUUID(), name: "Dedicated", units: 160, discount: 20, overageMultiplier: 1.15, termMonths: 12, noticeWeeks: 8 }
        ],

        init() {
        },

        // Labels
        periodLabel() { return this.period === "week" ? "week" : "month"; },
        unitTypeLabel() { return this.unitType === "days" ? "Days" : "Hours"; },
        unitTypeLabelPlural() { return this.unitType === "days" ? "days" : "hours"; },
        rateSuffix() { return this.unitType === "days" ? "€/day" : "€/h"; },
        preferenceLabel() {
            return this.preference === "flexibility"
                ? "Preference: Flexibility"
                : "Preference: Stability";
        },

        // Period conversions
        periodsPerYear() {
            return this.period === "week" ? 52 : 12;
        },
        periodsPerMonth() {
            return this.period === "week" ? (52 / 12) : 1;
        },

        // Numeric helpers
        clampPct(v) {
            const n = Number(v ?? 0);
            if (Number.isNaN(n)) return 0;
            return Math.max(0, Math.min(80, n));
        },
        clampNonNeg(v) {
            const n = Number(v ?? 0);
            if (Number.isNaN(n)) return 0;
            return Math.max(0, n);
        },
        fmtEUR(v) {
            const n = Number(v ?? 0);
            const safe = Number.isFinite(n) ? n : 0;
            return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(safe);
        },

        // Tier math
        unitsPerMonth(t) {
            return this.clampNonNeg(t.units) * this.periodsPerMonth();
        },
        unitsPerYear(t) {
            return this.clampNonNeg(t.units) * this.periodsPerYear();
        },
        pricePerPeriod(t) {
            const disc = 1 - (this.clampPct(t.discount) / 100);
            return this.clampNonNeg(t.units) * this.clampNonNeg(this.baseRate) * disc;
        },
        pricePerMonth(t) {
            return this.pricePerPeriod(t) * this.periodsPerMonth();
        },
        pricePerYear(t) {
            return this.pricePerPeriod(t) * this.periodsPerYear();
        },
        effectiveRate(t) {
            const um = this.unitsPerMonth(t);
            if (um <= 0) return 0;
            return this.pricePerMonth(t) / um;
        },
        overageRate(t) {
            const mult = Math.max(1, Number(t.overageMultiplier ?? 1));
            return this.clampNonNeg(this.baseRate) * mult;
        },
        capacityPct(t) {
            const um = this.unitsPerMonth(t);
            const baseline = this.unitType === "days"
                ? Math.max(1, Number(this.fullTimeDaysPerMonth ?? 20))
                : Math.max(1, Number(this.fullTimeHoursPerMonth ?? 160));
            return (um / baseline) * 100;
        },
        unitSummary(t) {
            const u = this.clampNonNeg(t.units);
            return `${u} ${this.unitTypeLabelPlural()}/${this.periodLabel()} · ${this.clampPct(t.discount)}% off`;
        },

        // Terms / scoring
        termText(t) {
            const m = Math.max(0, Number(t.termMonths ?? 0));
            if (m === 0) return "No minimum term";
            return `Term: ${m} month${m === 1 ? "" : "s"}`;
        },
        noticeText(t) {
            const w = Math.max(0, Number(t.noticeWeeks ?? 0));
            if (w === 0) return "Notice: none";
            return `Notice: ${w} week${w === 1 ? "" : "s"}`;
        },
        score(t) {
            // Map term months (cap 12) + notice weeks (cap 12) into 0..100.
            const term = Math.max(0, Math.min(12, Number(t.termMonths ?? 0))) / 12;     // 0..1
            const notice = Math.max(0, Math.min(12, Number(t.noticeWeeks ?? 0))) / 12;  // 0..1

            const wTerm = 0.65;
            const wNotice = 0.35;

            let s;
            if (this.preference === "flexibility") {
                s = (wTerm * (1 - term) + wNotice * (1 - notice)) * 100;
            } else {
                s = (wTerm * term + wNotice * notice) * 100;
            }
            return Math.round(Math.max(0, Math.min(100, s)));
        },
        scoreExplanation(t) {
            if (this.preference === "flexibility") {
                return "Higher score = easier to exit / less lock-in";
            }
            return "Higher score = more predictable revenue / less churn risk";
        },
        bestTierIndex() {
            let bestIdx = 0;
            let bestScore = -1;
            for (let i = 0; i < this.tiers.length; i++) {
                const s = this.score(this.tiers[i]);
                if (s > bestScore) {
                    bestScore = s;
                    bestIdx = i;
                }
            }
            return bestIdx;
        },

        // Tier management
        addTier() {
            this.ok = "";
            this.error = "";
            this.tiers.push({
                id: crypto.randomUUID(),
                name: "",
                units: 0,
                discount: 0,
                overageMultiplier: 1.25,
                termMonths: 3,
                noticeWeeks: 4
            });
        },
        removeTier(i) {
            this.ok = "";
            this.error = "";
            if (this.tiers.length <= 1) return;
            this.tiers.splice(i, 1);
        },

        // JSON import/export
        downloadConfig() {
            this.ok = "";
            this.error = "";
            try {
                const payload = {
                    version: 1,
                    unitType: this.unitType,
                    period: this.period,
                    baseRate: Number(this.baseRate ?? 0),
                    fullTimeHoursPerMonth: Number(this.fullTimeHoursPerMonth ?? 160),
                    fullTimeDaysPerMonth: Number(this.fullTimeDaysPerMonth ?? 20),
                    preference: this.preference,
                    tiers: this.tiers.map(t => ({
                        name: t.name ?? "",
                        units: Number(t.units ?? 0),
                        discount: Number(t.discount ?? 0),
                        overageMultiplier: Number(t.overageMultiplier ?? 1.25),
                        termMonths: Number(t.termMonths ?? 0),
                        noticeWeeks: Number(t.noticeWeeks ?? 0)
                    }))
                };

                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "retainer_tiers_config.json";
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                this.ok = "Exported JSON config.";
            } catch (e) {
                this.error = "Export failed: " + String(e);
            }
        },

        uploadConfig(ev) {
            this.ok = "";
            this.error = "";
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const obj = JSON.parse(String(reader.result || "{}"));
                    this.applyConfig(obj);
                    this.ok = "Imported JSON config.";
                } catch (e) {
                    this.error = "Import failed: invalid JSON.";
                }
            };
            reader.readAsText(file);
        },

        applyConfig(obj) {
            if (!obj || typeof obj !== "object") throw new Error("invalid config");
            if (obj.unitType === "hours" || obj.unitType === "days") this.unitType = obj.unitType;
            if (obj.period === "week" || obj.period === "month") this.period = obj.period;
            if (obj.preference === "stability" || obj.preference === "flexibility") this.preference = obj.preference;

            if (Number.isFinite(Number(obj.baseRate))) this.baseRate = Number(obj.baseRate);
            if (Number.isFinite(Number(obj.fullTimeHoursPerMonth))) this.fullTimeHoursPerMonth = Number(obj.fullTimeHoursPerMonth);
            if (Number.isFinite(Number(obj.fullTimeDaysPerMonth))) this.fullTimeDaysPerMonth = Number(obj.fullTimeDaysPerMonth);

            if (Array.isArray(obj.tiers) && obj.tiers.length > 0) {
                this.tiers = obj.tiers.map(t => ({
                    id: crypto.randomUUID(),
                    name: String(t.name ?? ""),
                    units: Number(t.units ?? 0),
                    discount: Number(t.discount ?? 0),
                    overageMultiplier: Number(t.overageMultiplier ?? 1.25),
                    termMonths: Number(t.termMonths ?? 0),
                    noticeWeeks: Number(t.noticeWeeks ?? 0)
                }));
            }
        },

        resetExample() {
            this.ok = "";
            this.error = "";
            this.unitType = "hours";
            this.period = "month";
            this.baseRate = 60;
            this.fullTimeHoursPerMonth = 160;
            this.fullTimeDaysPerMonth = 20;
            this.preference = "stability";
            this.tiers = [
                { id: crypto.randomUUID(), name: "Core", units: 40, discount: 10, overageMultiplier: 1.25, termMonths: 3, noticeWeeks: 4 },
                { id: crypto.randomUUID(), name: "Growth", units: 80, discount: 15, overageMultiplier: 1.20, termMonths: 6, noticeWeeks: 6 },
                { id: crypto.randomUUID(), name: "Dedicated", units: 160, discount: 20, overageMultiplier: 1.15, termMonths: 12, noticeWeeks: 8 }
            ];
            this.ok = "Reset to example tiers.";
        }
    };
}