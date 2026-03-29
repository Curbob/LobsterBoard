# DevJarvis PR Workflow - MANDATORY PROCESS

## 🎯 Overview
This document defines the mandatory workflow for all DevJarvis development tasks. **EVERY code change MUST go through this process.**

## ✅ Step 1: Working Directory (CONFIGURED)
- ✅ **Fork Path:** `/Users/richardcurry/devjarvis/forks/LobsterBoard`
- ✅ **GitHub Fork:** https://github.com/DevJarvis-AI/LobsterBoard
- ✅ **Upstream:** https://github.com/Curbob/LobsterBoard
- ✅ **Token:** Available at `~/.config/devjarvis/github-token`

## 🌿 Step 2: Branch Strategy
```bash
# For each new task/feature
git checkout main
git pull upstream main
git checkout -b feature/task-name-from-paperclip
# Work on the feature
git add . && git commit -m "descriptive message"
git push -u origin feature/task-name-from-paperclip
```

## 🧪 Step 3: Pre-PR Requirements (MANDATORY)
**Every PR MUST include this checklist:**

### 🧪 Testing
- [ ] All existing tests pass (`npm test`)
- [ ] New functionality has tests
- [ ] Manual testing completed
- [ ] Cross-browser compatibility verified

### 🔒 Security Review  
- [ ] No hardcoded credentials
- [ ] Input validation implemented
- [ ] XSS protection maintained
- [ ] Auth flows unchanged/secure
- [ ] Dependencies reviewed

### 💡 Usefulness Assessment
- [ ] Clear benefit explanation
- [ ] Aligns with roadmap goals
- [ ] Performance impact assessed
- [ ] Breaking changes documented

## 📝 Step 4: PR Creation
```bash
# Create PR using GitHub CLI
cd /Users/richardcurry/devjarvis/forks/LobsterBoard
gh pr create \
  --base main \
  --head DevJarvis-AI:feature/task-name \
  --title "feat: Brief description of change" \
  --body "$(cat PR_TEMPLATE.md)" \
  --repo Curbob/LobsterBoard
```

## 📋 Step 5: PR Template
```markdown
## 🛠️ [Task Title] Implementation

**Implements [Phase/Task] from LobsterBoard improvement roadmap ([CUR-X])**

### What's Changed
- [Detailed list of changes]
- [Files modified/added]
- [Key improvements]

### Technical Details
- [Architecture decisions]
- [Breaking changes if any]
- [Migration notes if needed]

### Pre-PR Checklist
- 🧪 **Testing**: ✅ [Testing summary]
- 🔒 **Security Review**: ✅ [Security assessment] 
- 💡 **Usefulness**: ✅ [Benefit explanation]

### Dependencies
[List any new dependencies and justification]

### Usage
```bash
[How to test/use the new functionality]
```

**Ready for review!**
```

## 🔗 Reference Example
- **Example PR:** https://github.com/Curbob/LobsterBoard/pull/21
- **Test Infrastructure PR:** Shows proper structure and documentation

## ⚠️ Critical Notes
1. **NEVER commit directly to main** - always use feature branches
2. **NEVER push to Curbob's repo** - only to DevJarvis-AI fork
3. **ALWAYS test thoroughly** before creating PR
4. **ALWAYS follow the checklist** - no exceptions
5. **GitHub token** is available for CLI operations

## 🎯 Success Criteria
- ✅ PR created from DevJarvis-AI fork
- ✅ All checklist items completed
- ✅ Professional documentation
- ✅ Tests passing
- ✅ Ready for Rich's review

**This workflow ensures professional development practices and proper code review!**