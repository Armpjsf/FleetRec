@echo off
echo Preparing to commit and push FleetRec changes...

:: Check if git is initialized
if not exist .git (
    echo Initializing Git repository...
    git init
    git remote add origin https://github.com/Armpjsf/FleetRec.git
)

:: Set local user config so commit won't fail
echo Setting local git identity...
git config user.name "Armpjsf"
git config user.email "Armpjsf@users.noreply.github.com"

:: Fetch remote branch and align histories to avoid "unrelated histories" or "rejected" issues
echo Fetching remote changes...
git fetch origin

:: Reset branch pointer to remote main but keep local file modifications
echo Aligning local history with remote...
git checkout -B main
git reset --mixed origin/main

:: Add files
echo Adding modified files to git...
git add .

:: Commit
echo Committing changes...
git commit -m "feat: integrate Google Apps Script proxy for Bangchak oil price API and update settings UI"

:: Push to main branch
echo Pushing to GitHub (main)...
git push origin main

echo.
echo Process completed.
pause
