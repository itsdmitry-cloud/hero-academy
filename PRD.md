# PRODUCT REQUIREMENTS DOCUMENT

Project name: Академия Героев / Hero Academy  
Product type: Gamified educational web platform  
Platform: Web PWA  
Target users: children age 9–13  
Version: MVP v1

---

# 1. PRODUCT VISION

Hero Academy is a gamified learning platform where school activities are transformed into RPG gameplay.

Students become heroes.

School tasks become quests.

Mistakes cause damage.

Success gives experience.

The system must increase motivation through:

progress
competition
collection
levels
events
guilds
rewards

The product must feel like a game, not like school software.

---

# 2. GOALS

Increase student engagement

Increase homework completion

Increase lesson activity

Provide parents with clear progress

Provide teachers with control

Provide admin with analytics

---

# 3. TARGET USERS

Students age 9–13

Teachers

Parents

System admin

---

# 4. SCALE

Initial:

1000 students

Must support future:

10000+

Architecture must allow scaling.

---

# 5. USER ROLES

Student

Teacher

Parent

Admin

Each role has separate UI.

---

# 6. SCHOOL STRUCTURE

Admin creates school.

Admin creates classes.

Teacher assigned to class.

Student joins by code.

Parent linked to student.

One student → one class.

---

# 7. HERO MODEL

Each student has hero.

Hero has:

XP
Gold
HP
Level
Artifacts
Achievements
Streak

Level range:

1–100

XP requirement increases.

---

# 8. XP SYSTEM

XP given for:

homework
test
lesson activity
boss
teacher reward

Teacher may manually grant XP.

Admin may change XP rules.

XP must support balancing.

---

# 9. HP SYSTEM

HP represents hero life.

HP lost when:

mistake
penalty
boss damage

HP restored by:

potion
artifact
season reset

If HP = 0

hero inactive

Can be revived next season.

Optional paid revive.

Admin controls damage values.

---

# 10. GOLD SYSTEM

Gold is currency.

Gold gained:

quests
boss
streak
achievement
teacher reward

Gold spent:

potions
boosters
artifacts
cosmetics

Admin controls economy.

---

# 11. ARTIFACT SYSTEM

Artifact has:

id
name
rarity
icon
effect
duration
drop_rate
season

Rarity:

Common
Rare
Epic
Legendary

Artifact effects:

xp bonus
hp shield
skip day
gold bonus
damage reduce

Artifacts stored on shelf.

Shelf has slots.

Locked slots possible.

Admin can edit artifacts.

---

# 12. STREAK SYSTEM

Hero streak counts days.

1 task per day → +1

Miss → reset

Rewards:

3
7
14
30

Artifact may protect streak.

Class streak exists.

Class streak gives bonus.

---

# 13. BOSS SYSTEM

Teacher may create boss event.

Boss has HP.

Students deal damage.

Mistakes damage hero.

Boss UI must show:

hp bar
timer
avatar
participants

Boss gives reward.

Admin controls boss.

---

# 14. GUILD SYSTEM

Class = guild.

Guild score =

XP
quests
boss
artifacts

Leaderboards:

class
school
season

Guild rewards.

Guild screen must show:

members
rank
score
banner

---

# 15. SEASON SYSTEM

Season = quarter.

Season end:

reset HP
reset streak
save ranking
give rewards

Admin sets season.

---

# 16. NAVIGATION

Hero
Quests
Artifacts
Leaderboard
Shop

Separate:

Teacher
Admin
Parent

---

# 17. HERO SCREEN

avatar
name
level
xp bar
hp bar
gold
artifacts
streak
achievements

---

# 18. QUEST SCREEN

Types:

Quest
Dungeon
Boss

Fields:

subject
xp
gold
damage
deadline

---

# 19. ARTIFACT SCREEN

Grid shelf

Click shows info.

---

# 20. SHOP

HP potion
XP boost
artifact
cosmetic

Admin controls.

---

# 21. TEACHER PANEL

create quest
create boss
grant xp
damage hp
give artifact

Dashboard required.

---

# 22. PARENT PANEL

Parent sees:

tasks
mistakes
xp
gold
hp
activity

Read only.

---

# 23. ADMIN PANEL

Admin controls:

schools
classes
users
economy
artifacts
shop
season
analytics

Admin dashboard required.

---

# 24. ANALYTICS

Must show:

DAU
Retention
Completion
XP avg
HP survival
Teacher activity
Parent activity
Guild score

Charts required.

Filters required.

---

# 25. UI REQUIREMENTS

Use UI kit.

Use assets.

Do not auto design.

Must support game UI.

Assets folders required.

---

# 26. TECH

Next.js
React
Supabase
Postgres
PWA

Mobile first

---

# 27. FUTURE

Loot
Drops
Events
Season rewards

Not in MVP.

Architecture must support.

---

# 28. DOCUMENTATION RULES

IMPORTANT: When adding or modifying any game mechanic, database schema, or key backend variables, developers and AI agents MUST update the "database_schema_and_mechanics_reference.md" file to reflect the new actual state of the project.

---

# END