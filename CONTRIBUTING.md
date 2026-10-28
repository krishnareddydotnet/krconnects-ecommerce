# Contributing to KRConnects e-commerce

Read this once before your first commit. It explains the one-time setup on your laptop and how we work with branches, commits and pull requests.

---

## 1. One-time setup (per laptop)

Install these tools once. They install system-wide, so you can run the commands from any folder.

| Tool | Why we need it | Install (Windows) |
|---|---|---|
| Git | Version control | `winget install --id Git.Git -e` |
| Python 3 | Required by pre-commit (pip comes with it) | `winget install --id Python.Python.3.13 -e` |
| pre-commit | Runs our checks before every commit | `pip install pre-commit` |

Close and reopen your terminal, then check:

```powershell
git --version
python --version
pre-commit --version
```

> If `python --version` opens the Microsoft Store, turn off the shortcut:
> Settings → Apps → Advanced app settings → App execution aliases → switch off `python.exe` and `python3.exe`.

---

## 2. One-time setup (per clone)

Run this **inside the repo folder** every time you clone the repo:

```powershell
git clone https://github.com/krishnareddydotnet/krconnects-ecommerce.git
cd krconnects-ecommerce
pre-commit install
```

You should see: `pre-commit installed at .git\hooks\pre-commit`

**Why is this needed?** Git never installs hooks automatically from a cloned repo (for security). The config file `.pre-commit-config.yaml` comes with the clone, but the hook that runs it must be installed by you.

Optional: check all files once (the first run takes a few minutes while it downloads gitleaks):

```powershell
pre-commit run --all-files
```

---

## 3. What happens when you commit

Every time you run `git commit`, the hook scans **only your staged changes** with **gitleaks** (secret scanner).

| Result | What you see | What happens |
|---|---|---|
| No secrets found | `Detect hardcoded secrets....Passed` | The commit is created |
| Secret found | `Detect hardcoded secrets....Failed` | The commit is **blocked** (no commit is created) |

gitleaks looks for passwords, API keys, tokens, private keys and connection strings.
The secret value is shown as `REDACTED`, so it never appears in your terminal or logs.

---

## 4. If your commit is blocked

1. Read the finding: it shows the **File**, **Line** and **RuleID**.
2. Remove the secret from the code.
3. Put the value in the right place instead:
   - Local development: environment variable or .NET User Secrets (never committed)
   - Kubernetes: a Kubernetes Secret (later: Azure Key Vault)
   - GitHub Actions: repository secrets (`Settings → Secrets and variables → Actions`)
4. Stage the file again and commit:

```powershell
git add <file>
git commit -m "your message"
```

**Never use `git commit --no-verify`** to skip the check. The same gitleaks scan also runs in the CI pipeline, so a skipped secret is still caught there.

---

## 5. False positives (not a real secret)

If gitleaks flags something that is **not** a secret (for example, a fake value in a unit test):

1. Copy the `Fingerprint` line from the finding.
2. Add it to a file named `.gitleaksignore` in the repo root (one fingerprint per line).
3. Commit it through a pull request and explain in the PR why it is safe.

Do not disable gitleaks or delete the hook.

---

## 6. If a real secret was already committed or pushed

Deleting it from the code is **not enough**: it stays in Git history.

1. **Rotate the secret first** (create a new password/key and revoke the old one).
2. Tell the repo owner.
3. Then remove it from the code and update the place that uses it.

---

## 7. How we work: branches, commits and pull requests

`main` is protected. Nobody pushes to `main` directly; every change goes through a pull request.

**Branch names**

| Type | Example |
|---|---|
| New feature | `feature/cart-discount` |
| Bug fix | `fix/login-error` |
| Pipeline change | `ci/data-api-pr-checks` |
| Documentation | `docs/contributing-guide` |

**Daily flow**

```powershell
git checkout main
git pull                                   # always start from the latest main
git checkout -b feature/<short-name>       # new branch for your change

# ... make your changes ...

git status                                 # check only the files you expect are changed
git add <files>
git commit -m "feat(auth-api): add password reset endpoint"
git push -u origin feature/<short-name>
```

Then open a pull request on GitHub: **base `main` ← your branch**.

**Commit messages:** one line, [Conventional Commits](https://www.conventionalcommits.org/) style:

| Prefix | Use for |
|---|---|
| `feat(<service>):` | New feature |
| `fix(<service>):` | Bug fix |
| `ci:` | Pipeline / GitHub Actions changes |
| `docs:` | Documentation |
| `test:` | Tests only |
| `chore:` | Maintenance (versions, config) |
| `refactor:` | Code change with no behaviour change |

**Pull request checklist**

- [ ] Branch is up to date with `main`
- [ ] Builds and unit tests pass locally
- [ ] No secrets, passwords or connection strings in the code
- [ ] PR title and description explain **what** changed and **why**

After the PR is merged: delete the branch on GitHub, then locally:

```powershell
git checkout main
git pull
git branch -d feature/<short-name>
```

---

## 8. Need help?

Open an issue in the repo or contact the repo owner.
