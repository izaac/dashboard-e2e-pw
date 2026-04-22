#!/usr/bin/env sh
# Generate a backport diff report for a given upstream release branch.
#
# Compares both spec FILES and individual TESTS within shared specs.
#
# Usage:
#   ./scripts/branch-backport.sh release-2.14
#   ./scripts/branch-backport.sh release-2.13
#
# Requires: upstream dashboard repo at ../dashboard (or set DASHBOARD_DIR)

set -eu

RELEASE_BRANCH="${1:?Usage: $0 <release-branch>  (e.g. release-2.14)}"
DASHBOARD_DIR="${DASHBOARD_DIR:-../dashboard}"
SPEC_PATH="cypress/e2e/tests/pages/"

if [ ! -d "$DASHBOARD_DIR/.git" ]; then
    echo "ERROR: Dashboard repo not found at $DASHBOARD_DIR" >&2
    exit 1
fi

cd "$DASHBOARD_DIR"

git fetch origin "$RELEASE_BRANCH" --depth=1 2>/dev/null || {
    echo "ERROR: Could not fetch origin/$RELEASE_BRANCH" >&2
    exit 1
}

TMPDIR_BP=$(mktemp -d)
trap 'rm -rf "$TMPDIR_BP"' EXIT

# --- File-level diff ---
git ls-tree -r --name-only origin/master -- "$SPEC_PATH" | grep '\.spec\.ts$' | LC_ALL=C sort >"$TMPDIR_BP/master"
git ls-tree -r --name-only "origin/$RELEASE_BRANCH" -- "$SPEC_PATH" | grep '\.spec\.ts$' | LC_ALL=C sort >"$TMPDIR_BP/release"

TO_DELETE=$(diff "$TMPDIR_BP/master" "$TMPDIR_BP/release" | grep "^<" | sed 's/^< //' || true)
TO_ADD=$(diff "$TMPDIR_BP/master" "$TMPDIR_BP/release" | grep "^>" | sed 's/^> //' || true)

MASTER_COUNT=$(wc -l <"$TMPDIR_BP/master" | tr -d ' ')
RELEASE_COUNT=$(wc -l <"$TMPDIR_BP/release" | tr -d ' ')
DELETE_COUNT=0
ADD_COUNT=0
[ -n "$TO_DELETE" ] && DELETE_COUNT=$(printf '%s\n' "$TO_DELETE" | wc -l | tr -d ' ')
[ -n "$TO_ADD" ] && ADD_COUNT=$(printf '%s\n' "$TO_ADD" | wc -l | tr -d ' ')

echo "# Backport Diff: master -> $RELEASE_BRANCH"
echo ""
echo "Master specs: $MASTER_COUNT"
echo "Release specs: $RELEASE_COUNT"
echo ""

# --- Specs to delete ---
if [ "$DELETE_COUNT" -gt 0 ]; then
    echo "## SPECS TO DELETE ($DELETE_COUNT)"
    echo ""
    printf '%s\n' "$TO_DELETE" | while IFS= read -r spec; do
        pw_path=$(echo "$spec" | sed 's|^cypress/e2e/tests/pages/|e2e/tests/pages/|')
        echo "  rm $pw_path"
    done
    echo ""
else
    echo "## No specs to delete"
    echo ""
fi

# --- Specs to add ---
if [ "$ADD_COUNT" -gt 0 ]; then
    echo "## SPECS TO ADD ($ADD_COUNT)"
    echo ""
    printf '%s\n' "$TO_ADD" | while IFS= read -r spec; do
        echo "  CONVERT: $spec"
    done
    echo ""
else
    echo "## No specs to add"
    echo ""
fi

# --- Extract test names from a file (POSIX: sed instead of grep -oP) ---
extract_tests() {
    # Matches it('name'), it("name"), it(`name`) — extracts name
    sed -n "s/.*it(['\"\`]\([^'\"\`]*\)['\"\`].*/\1/p" | grep -v "^@" | sort
}

# --- Per-test diff within shared specs ---
COMMON=$(comm -12 "$TMPDIR_BP/master" "$TMPDIR_BP/release")

echo "## PER-TEST DIFFS (shared specs with different tests)"
echo ""

printf '%s\n' "$COMMON" | while IFS= read -r spec; do
    [ -z "$spec" ] && continue

    git show "origin/master:$spec" 2>/dev/null | extract_tests >"$TMPDIR_BP/mt" || true
    git show "origin/$RELEASE_BRANCH:$spec" 2>/dev/null | extract_tests >"$TMPDIR_BP/rt" || true

    if ! cmp -s "$TMPDIR_BP/mt" "$TMPDIR_BP/rt"; then
        pw_path=$(echo "$spec" | sed 's|^cypress/e2e/tests/pages/|e2e/tests/pages/|')
        mc=$(wc -l <"$TMPDIR_BP/mt" | tr -d ' ')
        rc=$(wc -l <"$TMPDIR_BP/rt" | tr -d ' ')
        echo "### $pw_path  (master=$mc, $RELEASE_BRANCH=$rc)"

        in_master_only=$(diff "$TMPDIR_BP/rt" "$TMPDIR_BP/mt" | grep "^>" | sed 's/^> //' || true)
        if [ -n "$in_master_only" ]; then
            echo "  REMOVE (not in $RELEASE_BRANCH):"
            printf '%s\n' "$in_master_only" | while IFS= read -r t; do
                echo "    - $t"
            done
        fi

        in_release_only=$(diff "$TMPDIR_BP/rt" "$TMPDIR_BP/mt" | grep "^<" | sed 's/^< //' || true)
        if [ -n "$in_release_only" ]; then
            echo "  ADD BACK (only in $RELEASE_BRANCH):"
            printf '%s\n' "$in_release_only" | while IFS= read -r t; do
                echo "    - $t"
            done
        fi
        echo ""
    fi
done

echo ""
echo "## NEXT STEPS"
echo "1. git checkout -b $RELEASE_BRANCH"
[ "$DELETE_COUNT" -gt 0 ] && echo "2. Delete $DELETE_COUNT spec(s)"
[ "$ADD_COUNT" -gt 0 ] && echo "3. Convert $ADD_COUNT spec(s) from upstream Cypress"
echo "4. Apply per-test diffs (remove/add individual tests)"
echo "5. Run yarn po-diff against upstream $RELEASE_BRANCH for selector drift"
echo "6. Test against Rancher $(echo "$RELEASE_BRANCH" | sed 's/release-/v/').x instance"
