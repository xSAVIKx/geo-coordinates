# Content license

The lesson content of this project — the English, Polish and Ukrainian lesson
texts, the Explore step copy, the practice question and feedback wording, the
cheat sheet, and the worksheet content (in `src/i18n/*.json`, `src/topics/`,
`src/quiz/`, and the generated cheat sheet / worksheet pages) — is licensed
under the

**Creative Commons Attribution 4.0 International License (CC BY 4.0)**.

You are free to share and adapt this content for any purpose, even
commercially, as long as you give appropriate credit, provide a link to the
license, and indicate if changes were made. Full license text:
<https://creativecommons.org/licenses/by/4.0/>

Attribution:

> "Coordinates on the globe / Współrzędne / Координати" lesson content by
> Yurii Serhiichuk, licensed under CC BY 4.0.

This license does **not** cover the application's source code (see `LICENSE`,
MIT), and it does not cover the third-party data described below.

## Third-party data

- **Map and place data** — land, borders, graticule and place data are derived
  from [Natural Earth](https://www.naturalearthdata.com/), which is placed in
  the **public domain**. No attribution is legally required, but this project
  credits Natural Earth in its footer and README as a courtesy. World land
  topology comes from [world-atlas](https://github.com/topojson/world-atlas)
  (ISC license), also derived from Natural Earth data. World country borders
  follow Natural Earth's Poland point-of-view admin-0 countries dataset
  (`ne_10m_admin_0_countries_pol`, version 5.1.1), which shows Ukraine's
  internationally recognised borders, including Crimea.

- **Relief and satellite images** — the Physical map style uses Natural Earth's
  "Cross Blended Hypso with Shaded Relief and Water" (`HYP_50M_SR_W`, public
  domain). The Satellite map style uses NASA Earth Observatory's Blue Marble
  Next Generation (July 2004) and Black Marble 2016 images, which are not
  subject to copyright in the United States; credit: NASA Earth Observatory.
  The Political map style's country shapes are Natural Earth's Poland
  point-of-view admin-0 countries (`ne_10m_admin_0_countries_pol`, public domain).

- **City close-up photos and street data** — the twelve city close-up boxes
  (Places up close) bundle an aerial or satellite photo and an OpenStreetMap
  street/rail/water/park extract for each place, from six sources:

  - **Copernicus Sentinel-2 L2A** (Greenwich, Mitad del Mundo, Rovaniemi,
    Delhi, Sydney, Giza) — Free, full and open data policy.
    Credit: "Contains modified Copernicus Sentinel data 2024-2026", obtained
    from the Earth Search catalogue on AWS.
    <https://sentinels.copernicus.eu/>
  - **GUGiK ORTOFOTOMAPA** (Katowice, Warsaw, Krakow) — Geoportal
    regulations. Credit: "Ortofotomapa, Główny Urząd Geodezji i
    Kartografii, geoportal.gov.pl."
    <https://www.geoportal.gov.pl/>
  - **IGN BD ORTHO** (Paris) — Licence Ouverte / Open Licence Etalab 2.0.
    Credit: "Orthophotos © IGN / Géoplateforme (data.geopf.fr), Licence
    Ouverte / Open Licence Etalab 2.0."
    <https://data.geopf.fr/>
  - **GSI seamlessphoto** (Tokyo) — GSI tile terms of use. Credit, in the
    language the service prescribes it in and then in English:
    "空中写真: 国土地理院シームレス空中写真（加工）/ Aerial photo: Geospatial
    Information Authority of Japan, seamlessphoto tiles (processed:
    cropped and resampled)."
    <https://maps.gsi.go.jp/development/ichiran.html>
  - **USDA-FSA NAIP** (Manhattan) — public domain. Credit: "USDA-FSA
    National Agriculture Imagery Program (NAIP), via USGS." US federal
    imagery is in the public domain.
    <https://imagery.nationalmap.gov/>
  - **OpenStreetMap** (all twelve boxes: streets, railways, waterways,
    water and green areas) — Open Database Licence (ODbL) 1.0. Credit:
    "© OpenStreetMap contributors." Any rights in individual contents of
    the database are licensed under the Database Contents Licence.
    <https://www.openstreetmap.org/copyright>

  Every one of these six credit lines also travels inside the built file
  itself, in the third-party licence notice comment written by
  `scripts/licence-notices.ts`.

- **Maple Bear school locations** — the coordinates and names shown on the
  optional Maple Bear schools layer are factual data (approximate school
  locations) collected from publicly published Maple Bear school websites.
  Facts such as a school's location are not copyrightable; this data is
  included for the sole purpose of an educational map exercise. "Maple Bear"
  is a trademark of its respective owner. This project is an independent,
  unofficial educational resource and is **not affiliated with, endorsed by,
  or sponsored by Maple Bear** (or Google, whose map products are referenced
  in one topic as a real-world example of coordinate notation).
