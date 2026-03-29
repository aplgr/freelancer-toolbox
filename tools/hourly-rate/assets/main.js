function rateApp() {
    return {
        loading: true,
        error: "",
        // Data loaded from server-side JSON
        categories: { private: [], business: [], unproductive: [] },
        taxModels: [],
        presets: [],
        presetFile: "",

        // Config state (filled by preset)
        config: {
            name: "",
            tax: { modelId: "", params: {} },
            work: { workDaysPerYear: 0, holidays: 0, hoursPerDay: 0 },
            unproductiveDays: [],
            privateExpenses: [],
            businessExpenses: []
        },

        // Tax param fields rendered in the UI
        taxParamFields: [
            { key: "basicAllowance", label: "Basic allowance (EUR)" },
            { key: "zone1Upper", label: "Zone 1 upper bound (EUR)" },
            { key: "zone2Upper", label: "Zone 2 upper bound (EUR)" },
            { key: "zDivisor", label: "Z divisor" },

            { key: "zone1_a", label: "Zone 1 coefficient a" },
            { key: "zone1_b", label: "Zone 1 coefficient b" },
            { key: "zone1_roundDecimals", label: "Zone 1 rounding decimals" },

            { key: "zone2_a", label: "Zone 2 coefficient a" },
            { key: "zone2_b", label: "Zone 2 coefficient b" },
            { key: "zone2_c", label: "Zone 2 constant c" },

            { key: "zone3_rate", label: "Zone 3 rate" },
            { key: "zone3_intercept", label: "Zone 3 intercept" },

            { key: "soli_rate", label: "Soli rate" },
            { key: "soli_threshold_incomeTax", label: "Soli threshold (income tax)" }
        ],

        // Keep a copy of the last loaded preset for "reload preset"
        _lastPreset: null,

        async init() {
            this.loading = true;
            this.error = "";

            try {
                // Load categories
                const cat = await fetch("data/categories.json", { cache: "no-store" });
                if (!cat.ok) throw new Error("Failed to load data/categories.json");
                this.categories = await cat.json();

                // Load tax models
                const tm = await fetch("data/tax_models.json", { cache: "no-store" });
                if (!tm.ok) throw new Error("Failed to load data/tax_models.json");
                this.taxModels = await tm.json();

                // Load presets
                const p = await fetch("presets/index.json", { cache: "no-store" });
                if (!p.ok) throw new Error("Failed to load presets/index.json");
                this.presets = await p.json();

                // Auto-load first preset
                if (this.presets.length > 0) {
                    this.presetFile = this.presets[0].file;
                    await this.loadPreset(this.presetFile);
                } else {
                    this.loading = false;
                }
            } catch (err) {
                this.error = String(err && err.message ? err.message : err);
                this.loading = false;
            }
        },

        get selectedTaxModel() {
            return (this.taxModels || []).find(m => m.id === this.config.tax.modelId) || null;
        },

        get effectiveTaxParams() {
            const base = (this.selectedTaxModel && this.selectedTaxModel.params) ? this.selectedTaxModel.params : {};
            const override = (this.config.tax && this.config.tax.params) ? this.config.tax.params : {};
            // Empty / null override => ignore
            const merged = { ...base };
            for (const k in override) {
                const v = override[k];
                if (v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v))) {
                    merged[k] = Number(v);
                }
            }
            return merged;
        },

        onTaxModelChange() {
            // Keep overrides, but ensure object exists
            if (!this.config.tax) this.config.tax = { modelId: "", params: {} };
            if (!this.config.tax.params) this.config.tax.params = {};
        },

        async loadPreset(file) {
            if (!file) return;
            this.loading = true;
            this.error = "";

            try {
                const res = await fetch(file, { cache: "no-store" });
                if (!res.ok) throw new Error("Preset could not be loaded: " + file);
                const cfg = await res.json();
                this.applyConfig(cfg);
                this._lastPreset = JSON.parse(JSON.stringify(cfg));
            } catch (err) {
                this.error = String(err && err.message ? err.message : err);
            } finally {
                this.loading = false;
            }
        },

        resetToPreset() {
            if (!this._lastPreset) return;
            this.applyConfig(JSON.parse(JSON.stringify(this._lastPreset)));
        },

        applyConfig(cfg) {
            const safe = (v, d) => (v === undefined || v === null) ? d : v;

            this.config.name = safe(cfg.name, "");

            this.config.tax = {
                modelId: String(safe(cfg.tax?.modelId, (this.taxModels[0] ? this.taxModels[0].id : ""))),
                params: safe(cfg.tax?.params, {})
            };

            this.config.work = {
                workDaysPerYear: Number(safe(cfg.work?.workDaysPerYear, 0)),
                holidays: Number(safe(cfg.work?.holidays, 0)),
                hoursPerDay: Number(safe(cfg.work?.hoursPerDay, 0))
            };

            const normExpense = (x) => ({
                category: String(safe(x.category, "")),
                label: String(safe(x.label, "")),
                monthly: Number(safe(x.monthly, 0))
            });

            const normUnprod = (x) => ({
                category: String(safe(x.category, "")),
                label: String(safe(x.label, "")),
                days: Number(safe(x.days, 0))
            });

            this.config.privateExpenses = (safe(cfg.privateExpenses, [])).map(normExpense);
            this.config.businessExpenses = (safe(cfg.businessExpenses, [])).map(normExpense);
            this.config.unproductiveDays = (safe(cfg.unproductiveDays, [])).map(normUnprod);

            // Ensure at least one row exists so UI isn't empty
            if (this.config.privateExpenses.length === 0) this.addExpenseRow("privateExpenses");
            if (this.config.businessExpenses.length === 0) this.addExpenseRow("businessExpenses");
            if (this.config.unproductiveDays.length === 0) this.addUnproductiveRow();

            // Ensure current tax model exists; fallback to first model
            if (!this.selectedTaxModel && this.taxModels.length > 0) {
                this.config.tax.modelId = this.taxModels[0].id;
            }
            this.onTaxModelChange();
        },

        // Row helpers
        addExpenseRow(listName) {
            const list = this.config[listName];
            if (!Array.isArray(list)) return;

            const catList = listName === "privateExpenses" ? (this.categories.private || [])
                : (this.categories.business || []);
            const defaultCat = catList.length ? catList[0] : "";

            list.push({ category: defaultCat, label: "", monthly: 0 });
        },

        addUnproductiveRow() {
            const catList = (this.categories.unproductive || []);
            const defaultCat = catList.length ? catList[0] : "";
            this.config.unproductiveDays.push({ category: defaultCat, label: "", days: 0 });
        },

        removeRow(listName, idx) {
            const list = this.config[listName];
            if (!Array.isArray(list)) return;
            list.splice(idx, 1);
            // Keep at least 1 row for UX
            if (list.length === 0) {
                if (listName === "unproductiveDays") this.addUnproductiveRow();
                if (listName === "privateExpenses") this.addExpenseRow("privateExpenses");
                if (listName === "businessExpenses") this.addExpenseRow("businessExpenses");
            }
        },

        // JSON import/export
        downloadConfig() {
            const payload = JSON.stringify(this.config, null, 2);
            const blob = new Blob([payload], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = (this.config.name ? this.slug(this.config.name) : "hourly-rate-config") + ".json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        },

        async uploadConfig(ev) {
            this.error = "";
            const file = ev.target.files && ev.target.files[0];
            ev.target.value = "";
            if (!file) return;
            try {
                const txt = await file.text();
                const cfg = JSON.parse(txt);
                this.applyConfig(cfg);
            } catch (err) {
                this.error = "Invalid JSON: " + String(err && err.message ? err.message : err);
            }
        },

        slug(s) {
            return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        },

        // Formatting
        fmtEUR(v) {
            const n = Number(v);
            if (!isFinite(n)) return "€0";
            try {
                return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
            } catch (e) {
                return "€" + Math.round(n).toString();
            }
        },
        fmtNum(v) {
            const n = Number(v);
            if (!isFinite(n)) return "0";
            return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(n);
        },

        // Calculations (spreadsheet-inspired, but with a correct tax gross-up)
        get calc() {
            const workDays = this.num(this.config.work.workDaysPerYear);
            const holidays = this.num(this.config.work.holidays);
            const hoursPerDay = this.num(this.config.work.hoursPerDay);

            const possibleWorkDays = Math.max(workDays - holidays, 0);

            const unprodTotal = (this.config.unproductiveDays || [])
                .reduce((s, r) => s + this.num(r.days), 0);

            const productiveDays = Math.max(possibleWorkDays - unprodTotal, 0);
            const billableHoursYear = productiveDays * Math.max(hoursPerDay, 0);

            const privateAnnual = (this.config.privateExpenses || [])
                .reduce((s, r) => s + this.num(r.monthly) * 12, 0);

            const businessAnnual = (this.config.businessExpenses || [])
                .reduce((s, r) => s + this.num(r.monthly) * 12, 0);

            // Improved tax handling:
            // We solve for gross taxable income G so that (G - tax(G)) == privateAnnual.
            // Then required annual revenue = businessAnnual + G
            const grossTaxableSolved = this.solveGrossForNet(privateAnnual, this.effectiveTaxParams);

            const taxes = this.computeTax(grossTaxableSolved, this.effectiveTaxParams);
            const requiredAnnualRevenue = businessAnnual + grossTaxableSolved;

            const dayRate = productiveDays > 0 ? (requiredAnnualRevenue / productiveDays) : 0;
            const hourRate = hoursPerDay > 0 ? (dayRate / hoursPerDay) : 0;

            return {
                possibleWorkDays,
                unproductiveDaysTotal: unprodTotal,
                productiveDays,
                billableHoursYear,

                privateAnnual,
                businessAnnual,

                grossTaxableSolved,

                taxesIncomeTax: taxes.incomeTax,
                taxesSoli: taxes.soli,
                taxesTotal: taxes.total,

                requiredAnnualRevenue,
                dayRate,
                hourRate
            };
        },

        num(v) {
            const n = Number(v);
            return isFinite(n) ? n : 0;
        },

        computeTax(taxable, p) {
            const x = this.num(taxable);

            const basicAllowance = this.num(p.basicAllowance);
            const zone1Upper = this.num(p.zone1Upper);
            const zone2Upper = this.num(p.zone2Upper);
            const zDivisor = this.num(p.zDivisor) || 10000;

            const z1a = this.num(p.zone1_a);
            const z1b = this.num(p.zone1_b);
            const z1round = Math.round(this.num(p.zone1_roundDecimals));

            const z2a = this.num(p.zone2_a);
            const z2b = this.num(p.zone2_b);
            const z2c = this.num(p.zone2_c);

            const z3rate = this.num(p.zone3_rate);
            const z3intercept = this.num(p.zone3_intercept);

            const soliRate = this.num(p.soli_rate);
            const soliThreshold = this.num(p.soli_threshold_incomeTax);
            const soliMode = String(p.soli_threshold_mode || "zone1_only");

            let incomeTax = 0;
            let soli = 0;

            if (x > basicAllowance && x < zone1Upper) {
                const z = (x - basicAllowance) / zDivisor;
                const raw = (z1a * z + z1b) * z;
                const factor = Math.pow(10, z1round);
                incomeTax = Math.round(raw * factor) / factor;

                if (soliMode === "zone1_only") {
                    soli = incomeTax > soliThreshold ? incomeTax * soliRate : 0;
                } else {
                    soli = incomeTax > soliThreshold ? incomeTax * soliRate : 0;
                }
            } else if (x > (zone1Upper + 1) && x < zone2Upper) {
                const z = (x - zone1Upper) / zDivisor;
                incomeTax = (z2a * z + z2b) * z + z2c;
                soli = incomeTax * soliRate;
            } else if (x > (zone2Upper + 1)) {
                incomeTax = z3rate * x + z3intercept;
                soli = incomeTax * soliRate;
            } else {
                incomeTax = 0;
                soli = 0;
            }

            const total = incomeTax + soli;
            return { incomeTax, soli, total };
        },

        solveGrossForNet(net, params) {
            const targetNet = this.num(net);
            if (targetNet <= 0) return 0;

            // If taxes are zero at net, gross equals net
            const tAtNet = this.computeTax(targetNet, params).total;
            if (tAtNet <= 0) return targetNet;

            // f(g) = g - tax(g)
            const f = (g) => g - this.computeTax(g, params).total;

            let lo = targetNet;
            let hi = targetNet * 2;

            // Increase hi until f(hi) >= targetNet
            for (let i = 0; i < 50; i++) {
                if (f(hi) >= targetNet) break;
                hi *= 2;
            }

            // Binary search
            for (let i = 0; i < 80; i++) {
                const mid = (lo + hi) / 2;
                const netMid = f(mid);
                if (netMid >= targetNet) {
                    hi = mid;
                } else {
                    lo = mid;
                }
            }

            return hi;
        }
    };
}
