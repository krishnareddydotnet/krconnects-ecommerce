# Runbook: a secret was committed to krconnects-ecommerce

Use this when a real secret (password, API key, token, connection string) has reached the repo
`krishnareddydotnet/krconnects-ecommerce` (https://github.com/krishnareddydotnet/krconnects-ecommerce).

> **Golden rule: rotate first, clean history second.**
> Once a secret is pushed, assume it is compromised. Anyone may already have cloned or forked the repo.
> Rewriting history removes the text, but only **rotation** makes the leaked secret useless.

---

## Step 1: Rotate the secret (mandatory, do it immediately)

1. **Revoke** the leaked secret at its source:

   | Secret type | Where to revoke |
   |---|---|
   | GitHub token | GitHub → Settings → Developer settings → Personal access tokens → Delete |
   | Docker Hub token | Docker Hub → Account settings → Personal access tokens → Delete |
   | Azure Storage key | Azure portal → Storage account → Access keys → Rotate key |
   | Azure SQL password | Azure portal → SQL server → Reset password |
   | Entra ID client secret | Entra ID → App registrations → Certificates & secrets → Delete |
   | JWT signing key (`Jwt__Key`) | Generate a new key and update the `auth-api-secret` Kubernetes Secret |

2. **Create a new secret** and update every place that uses it
   (GitHub repository secrets, Kubernetes Secrets, Key Vault).
3. **Restart** the apps that use it so they read the new value.
4. Check the source's logs (Azure Activity Log, GitHub audit log) for any use of the old secret.

---

## Step 2: Handle the secret scanning alert

1. Repo → **Security and quality → Secret scanning**.
2. Open the alert for the leaked secret.
3. After rotation, close it as **Revoked**.

---

## Step 3: Decide whether to rewrite history

| Situation | Rewrite history? |
|---|---|
| Secret rotated, low risk, team prefers stability | No: rotation is enough |
| Compliance or policy requires removal | Yes |
| Sensitive data that cannot be rotated (e.g. personal data) | Yes |

Rewriting history is **disruptive**: every commit after the leak gets a new ID, it needs a force push,
and every developer must re-clone. Only continue if Step 3 says "Yes".

---

## Step 4: Rewrite history with git-filter-repo (repo admin only)

### 4.1 Install the tool (once per laptop)

```powershell
pip install git-filter-repo
git filter-repo --version
```

### 4.2 Work in a fresh clone (NOT your normal working copy)

git-filter-repo refuses to run on a used working copy, as a safety check.

```powershell
cd D:\krconnects
git clone https://github.com/krishnareddydotnet/krconnects-ecommerce.git krconnects-ecommerce-clean
cd krconnects-ecommerce-clean
```

### 4.3 Remove the secret (choose ONE option)

**Option A: replace the secret text in every commit** (keeps the file, removes only the value)

Create `D:\krconnects\replacements.txt` **outside the repo** with one line per secret:

```
<the-real-secret-value>==>***REMOVED***
```

Then run:

```powershell
git filter-repo --replace-text D:\krconnects\replacements.txt
```

**Option B: delete a whole file from every commit** (when the file should never have existed)

```powershell
git filter-repo --invert-paths --path push-test.txt
```

### 4.4 Verify the secret is gone

```powershell
git log --all --oneline -S "<the-real-secret-value>"   # must print nothing
gitleaks git -v                                         # must say: no leaks found
```

### 4.5 Allow a force push on main (temporarily)

`main` is protected, so a force push is blocked.

1. GitHub → repo **Settings → Branches** (or **Rules → Rulesets**) → edit the `main` rule.
2. Temporarily **allow force pushes** for the repo admin only.

### 4.6 Push the rewritten history

git-filter-repo removes `origin` as a safety step, so add it back:

```powershell
git remote add origin https://github.com/krishnareddydotnet/krconnects-ecommerce.git
git push --force --all
git push --force --tags
```

### 4.7 Restore protection and clean up

1. **Turn force pushes off again** on `main` (undo step 4.5).
2. **Delete `D:\krconnects\replacements.txt`**: it contains the real secret.

```powershell
Remove-Item D:\krconnects\replacements.txt
```

---

## Step 5: Tell the team

Send this to every developer:

> History of `krconnects-ecommerce` was rewritten to remove a leaked secret.
> 1. Push any unfinished work to a branch first, or save it as a patch.
> 2. Delete your old clone: `D:\krconnects\krconnects-ecommerce`
> 3. Clone again: `git clone https://github.com/krishnareddydotnet/krconnects-ecommerce.git`
> 4. Run `pre-commit install` again (see CONTRIBUTING.md).
> 5. Do NOT push from an old clone: it would bring the secret back.

Open pull requests based on the old history must be closed and recreated.

---

## Step 6: Remove cached copies on GitHub

Old commits can still be visible through cached views, forks and old pull request refs.
Contact **GitHub Support** and ask them to purge cached views and old PR refs for the affected commits
(include the repo name and the old commit IDs).

---

## Step 7: Prevent it happening again

- Make sure every developer has run `pre-commit install` (gitleaks on every commit).
- Keep **Secret Protection** and **Push protection** enabled
  (Settings → Advanced Security).
- Store secrets only in GitHub repository secrets, Kubernetes Secrets or Azure Key Vault, never in code.
- Write a short incident note: what leaked, when, how it was found, what was rotated.

---

## Quick checklist

- [ ] Secret revoked and replaced (Step 1)
- [ ] Apps restarted with the new secret
- [ ] Secret scanning alert closed as Revoked (Step 2)
- [ ] History rewritten, if required (Step 4)
- [ ] Force push turned off again on `main`
- [ ] `replacements.txt` deleted
- [ ] Team re-cloned (Step 5)
- [ ] GitHub Support contacted for cached views (Step 6)
- [ ] Incident note written (Step 7)
