# SYSTÃˆME DE RÃˆGLES - AGABY 2026 (OPTIMISÃ‰ PARA)

## 1. Naming Convention (Nommage des Fichiers)
Tout fichier important DOIT suivre ce format :
YYYYMMDD_Projet_Type_V1.ext

**Exemples :**
- 20260430_VillaX_Devis_V1.xlsx
- 20260430_BotTrading_Code_V2.py
- 20260502_DINEPA_RapportHebdo_V1.docx

## 2. RÃ¨gles Critiques de Placement
1. **PAS de fichiers Ã  la racine :** Tout fichier doit vivre Ã  l'intÃ©rieur d'un dossier.
2. **Limite ACTIVE :**  1_ACTIVE ne doit pas contenir plus de 5 Ã  7 projets pour Ã©viter de perdre le focus.
3. **Structure des Projets :** Chaque projet (dans ACTIVE ou PROJECTS) doit toujours avoir ces sous-dossiers :
   -  1_DOCS
   -  2_WORK
   -  3_EXPORTS

## 3. Règles pour l'INBOX (Tri Rapide)
Chaque jour (ou max 48h), pour chaque fichier dans `00_INBOX` :
- S'il a un rapport avec un projet actif → envoyer dans `01_ACTIVE`
- Si c'est une référence → envoyer dans `03_RESOURCES`
- S'il est terminé/archivable → envoyer dans `02_PROJECTS` ou `04_ARCHIVE`
- Si vous ne savez pas → laissez-le MAIS marquez-le
**RÈGLE D'OR :** Ne jamais laisser plus de 20 fichiers dans l'INBOX.

## 4. Le Flux de Travail (Pipeline)
- `00_INBOX` : Point d'entrée de tous les fichiers (Téléchargements auto ou manuels). 
- `01_ACTIVE` : Les projets sur lesquels vous travaillez aujourd'hui.
- `02_PROJECTS` : Les projets en attente ou récurrents (GENIE_CIVIL, DEV_TECH, BUSINESS_REV, CONTENU, DINEPA).
- `03_RESOURCES` : Référence pure. Pas de travail actif ici (ADMIN, FINANCES, APPRENTISSAGE).
- `04_ARCHIVE` : Les projets terminés. Ne rien effacer dans la précipitation, l'envoyer ici.

## 4. Gestion des Doublons (Duplicates)
- Ne jamais supprimer des doublons de faÃ§on aveugle. Toujours vÃ©rifier les versions avant de jeter une copie.
