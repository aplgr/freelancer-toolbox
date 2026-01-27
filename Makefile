TOOLS_JSON := tools.json

.PHONY: tools-json
tools-json:
	python3 ./scripts/generate-tools-json.py

.PHONY: check-tools-json
check-tools-json:
	python3 ./scripts/generate-tools-json.py
	git diff --exit-code -- $(TOOLS_JSON)
