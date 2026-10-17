# Mudpie (Mastodon URL Discussion Protocol) Makefile
# Containerized builds and tests with Podman only

PODMAN ?= podman
IMAGE_NAME ?= mudpie
IMAGE_TAG ?= latest

.PHONY: all help build test clean image

# Default target
all: build

help:
	@echo "Mudpie Build System (Podman Only)"
	@echo "================================="
	@echo "  make build  - Build artifacts inside Podman container and export to dist/"
	@echo "  make test   - Run test suite inside Podman container"
	@echo "  make clean  - Remove build artifacts (dist directory)"
	@echo "  make image  - Build Podman container image ($(IMAGE_NAME):$(IMAGE_TAG))"

image:
	$(PODMAN) build -t $(IMAGE_NAME):$(IMAGE_TAG) .

build: image test
	mkdir -p dist
	$(PODMAN) run --rm -v $(CURDIR)/dist:/app/dist:Z $(IMAGE_NAME):$(IMAGE_TAG) node scripts/build.js

test: image
	$(PODMAN) run --rm $(IMAGE_NAME):$(IMAGE_TAG) node --test tests/*.test.js

clean:
	rm -rf dist
