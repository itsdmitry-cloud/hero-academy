1001"}
# PROJECT: HERO ACADEMY

You are designing a complex gamified educational web application.

Do not simplify architecture.

Work step by step.

Required workflow:

1. System architecture
2. Database schema
3. UI component structure
4. API design
5. Frontend structure
6. Backend structure
7. Code generation

If something is unclear — ask questions before generating code.

This project must support future scaling.

---

# PRODUCT DESCRIPTION

Hero Academy is a gamified educational platform for children aged 9–13.

Learning activities are converted into RPG gameplay.

Homework → Quest  
Independent work → Dungeon  
Test → Boss battle  

Mistakes cause damage to hero HP.  
Success gives XP and Gold.

The system must increase motivation through:

progress  
competition  
collection  
rewards  
levels  
artifacts  
guilds  
streak  
events  

---

# USER ROLES

The system has four roles.

Student  
Teacher  
Parent  
System Admin

---

# SCHOOL STRUCTURE

System Admin creates:

school  
classes inside school

Teacher is assigned to class.

Students join using invitation code.

Parent is linked to student.

---

# HERO MODEL

Each student has hero.

Hero parameters:

XP
Gold
HP
Level
Artifacts
Achievements
Streak

Level range:

1–100

XP required must increase per level.

---

# XP SYSTEM

XP gained from:

assignments
correct answers
lesson participation
boss battles
teacher reward

Teacher can manually grant XP.

Admin can change XP balance.

---

# HP SYSTEM

HP lost when:

mistake in homework
mistake in test
teacher penalty

HP restored by:

potion
artifact
season reset

If HP = 0

hero inactive until season end

Resurrection allowed:

next season
paid option

Admin can change HP damage.

---

# GOLD SYSTEM

Gold gained from:

quests
boss
achievements
streak
teacher reward

Gold spent on:

HP potion
XP boost
artifacts
cosmetics

Admin controls economy.

---

# ARTIFACT SYSTEM

Artifacts must support:

id
name
rarity
icon
effect
drop_rate
season_available
stackable
duration

Rarity:

Common
Rare
Epic
Legendary

Examples:

XP boost
damage shield
skip day
extra gold
hp regen

Artifacts displayed on shelf.

Shelf must support slots.

Locked slots allowed.

---

# STREAK SYSTEM

Hero Streak counts daily activity.

Rule:

1 quest per day = streak +1

Miss day = reset

Rewards:

3 days
7 days
14 days
30 days

Artifact may protect streak.

Class streak also exists.

Class streak increases if all students active.

Class streak gives bonuses.

---

# BOSS SYSTEM

Teacher can create boss event.

Boss has HP.

Students deal damage by solving tasks.

Mistakes damage hero.

Boss event shows:

boss avatar
hp bar
timer
participants

Rewards given when boss dies.

Admin can configure boss rules.

---

# GUILD SYSTEM

Class = guild.

Guild score calculated from:

XP
quests
bosses
artifacts

Guild leaderboard:

class
school
season

Guild rewards:

XP bonus
artifact
badge

Guild screen must show:

members
score
rank
banner

---

# SEASON SYSTEM

Season = school quarter.

Season end:

save leaderboard
give rewards
reset HP
reset streak

Admin controls season length.

---

# NAVIGATION

Bottom navigation:

Hero
Quests
Artifacts
Leaderboard
Shop

Teacher panel separate.

Admin panel separate.

Parent panel separate.

---

# HERO SCREEN

Must show:

avatar
name
level
xp bar
hp bar
gold
artifact shelf
achievements
streak

---

# QUEST SCREEN

Quest types:

Quest
Dungeon
Boss

Card fields:

subject
difficulty
xp
gold
damage
deadline

---

# ARTIFACT SCREEN

Grid shelf

Click shows details

---

# SHOP

Categories:

HP potion
XP boost
artifacts
cosmetics

Admin controls shop.

---

# TEACHER PANEL

Teacher can:

create quest
create boss
grant xp
damage hp
give artifact
view students

Teacher dashboard required.

---

# PARENT PANEL

Parent sees:

completed tasks
mistakes
xp
gold
hp
activity

Parent cannot edit.

---

# ADMIN PANEL

Admin controls:

schools
classes
users
artifacts
shop
economy
drop rates
seasons
analytics

Admin must have dashboard.

---

# ANALYTICS

Admin dashboard must show:

DAU
Retention
Completion rate
XP average
HP survival
Teacher activity
Parent activity
Guild score

Charts required.

Filters:

school
class
season
date

---

# FUTURE SYSTEM

Must support later:

artifact drops
loot boxes
season rewards
event rewards

Do not implement now.

---

# UI RULES

Use predefined UI assets.

Do not generate random UI.

Use asset library.

Assets folders:

/assets/ui
/assets/icons
/assets/artifacts
/assets/avatars
/assets/bosses
/assets/backgrounds

---

# TECH STACK

Frontend

Next.js
React

Backend

Supabase
Postgres

Auth

Class code

Format

PWA
Mobile first

---

# TASK

Design architecture first.

Then database.

Then UI.

Then API.

Then