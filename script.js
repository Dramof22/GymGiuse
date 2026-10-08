
const DATA_URL =
  "https://raw.githubusercontent.com/babyskill/gym-dataset/main/data/exercises.json";

const MEDIA_BASE =
  "https://raw.githubusercontent.com/babyskill/gym-dataset/main/";


let exercises = [];

let filteredExercises = [];

let selectedGroup = "all";

let visibleCount = 40;

let activeMedia = null;


const groups = [

  {
    id: "all",
    label: "Tutti",
    words: []
  },

  {
    id: "chest",
    label: "Petto",
    words: [
      "chest",
      "pector"
    ]
  },

  {
    id: "back",
    label: "Schiena",
    words: [
      "back",
      "lat",
      "trapez",
      "spine"
    ]
  },

  {
    id: "shoulders",
    label: "Spalle",
    words: [
      "shoulder",
      "delt"
    ]
  },

  {
    id: "arms",
    label: "Braccia",
    words: [
      "biceps",
      "triceps",
      "upper arms",
      "forearm",
      "lower arms"
    ]
  },

  {
    id: "abs",
    label: "Addome",
    words: [
      "waist",
      "abs",
      "abdominal",
      "oblique",
      "core"
    ]
  },

  {
    id: "glutes",
    label: "Glutei",
    words: [
      "glute"
    ]
  },

  {
    id: "legs",
    label: "Gambe",
    words: [
      "upper legs",
      "quadriceps",
      "hamstring",
      "adductor",
      "abductor"
    ]
  },

  {
    id: "calves",
    label: "Polpacci",
    words: [
      "lower legs",
      "calves",
      "calf"
    ]
  },

  {
    id: "cardio",
    label: "Cardio",
    words: [
      "cardio"
    ]
  },

  {
    id: "neck",
    label: "Collo",
    words: [
      "neck"
    ]
  }

];


const categoryItalian = {

  "chest":
    "Petto",

  "back":
    "Schiena",

  "shoulders":
    "Spalle",

  "upper arms":
    "Braccia",

  "lower arms":
    "Avambracci",

  "upper legs":
    "Gambe",

  "lower legs":
    "Polpacci",

  "waist":
    "Addome",

  "cardio":
    "Cardio",

  "neck":
    "Collo"

};


const equipmentItalian = {

  "body weight":
    "Corpo libero",

  "dumbbell":
    "Manubri",

  "barbell":
    "Bilanciere",

  "cable":
    "Cavi",

  "band":
    "Elastico",

  "resistance band":
    "Elastico",

  "kettlebell":
    "Kettlebell",

  "smith machine":
    "Smith Machine",

  "leverage machine":
    "Macchina",

  "assisted":
    "Macchina assistita",

  "ez barbell":
    "Bilanciere EZ",

  "stability ball":
    "Fitball",

  "medicine ball":
    "Palla medica",

  "bosu ball":
    "Bosu",

  "roller":
    "Foam roller",

  "rope":
    "Corda",

  "weighted":
    "Con sovraccarico",

  "sled machine":
    "Slitta",

  "stationary bike":
    "Cyclette",

  "elliptical machine":
    "Ellittica",

  "stepmill machine":
    "Stair climber",

  "tire":
    "Pneumatico",

  "trap bar":
    "Trap bar",

  "olympic barbell":
    "Bilanciere olimpico",

  "hammer":
    "Martello",

  "wheel roller":
    "Ab wheel"

};


const muscleItalian = {

  "abs":
    "Addominali",

  "abdominals":
    "Addominali",

  "pectorals":
    "Pettorali",

  "pectoralis major":
    "Grande pettorale",

  "chest":
    "Pettorali",

  "biceps":
    "Bicipiti",

  "triceps":
    "Tricipiti",

  "delts":
    "Deltoidi",

  "shoulders":
    "Deltoidi",

  "lats":
    "Gran dorsale",

  "latissimus dorsi":
    "Gran dorsale",

  "traps":
    "Trapezio",

  "trapezius":
    "Trapezio",

  "upper back":
    "Schiena alta",

  "lower back":
    "Lombari",

  "spine":
    "Erettori spinali",

  "glutes":
    "Glutei",

  "gluteus maximus":
    "Grande gluteo",

  "quadriceps":
    "Quadricipiti",

  "quads":
    "Quadricipiti",

  "hamstrings":
    "Femorali",

  "calves":
    "Polpacci",

  "calf":
    "Polpacci",

  "forearms":
    "Avambracci",

  "adductors":
    "Adduttori",

  "abductors":
    "Abduttori",

  "obliques":
    "Obliqui",

  "serratus anterior":
    "Dentato anteriore",

  "hip flexors":
    "Flessori dell'anca",

  "neck":
    "Collo"

};


const searchInput =
  document.getElementById(
    "searchInput"
  );

const muscleFilters =
  document.getElementById(
    "muscleFilters"
  );

const equipmentFilter =
  document.getElementById(
    "equipmentFilter"
  );

const sortFilter =
  document.getElementById(
    "sortFilter"
  );

const exerciseGrid =
  document.getElementById(
    "exerciseGrid"
  );

const exerciseCount =
  document.getElementById(
    "exerciseCount"
  );

const loading =
  document.getElementById(
    "loading"
  );

const loadMore =
  document.getElementById(
    "loadMore"
  );

const emptyState =
  document.getElementById(
    "emptyState"
  );


function escapeHtml(text = "") {

  return String(text)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


function mediaUrl(path) {

  if (!path) {
    return "";
  }

  return (
    MEDIA_BASE
    +
    path
      .split("/")
      .map(
        part =>
          encodeURIComponent(part)
      )
      .join("/")
  );

}


function categoryLabel(value) {

  return (
    categoryItalian[value]
    ||
    value
    ||
    "Altro"
  );

}


function equipmentLabel(value) {

  return (
    equipmentItalian[value]
    ||
    value
    ||
    "Nessuna"
  );

}


function muscleLabel(value) {

  if (!value) {
    return "Non indicato";
  }

  const lower =
    String(value)
      .toLowerCase();

  return (
    muscleItalian[lower]
    ||
    lower
      .split(" ")
      .map(
        word =>
          word.charAt(0).toUpperCase()
          +
          word.slice(1)
      )
      .join(" ")
  );

}


function renderGroupFilters() {

  muscleFilters.innerHTML =

    groups
      .map(
        group => `

          <button

            class="
              muscle-filter
              ${
                group.id === "all"
                ? "active"
                : ""
              }
            "

            data-group="${group.id}"

          >
            ${group.label}
          </button>

        `
      )
      .join("");

}



// GYMGIUSE_ITALIAN_SEARCH_V2

const gymItalianWords = [
  ["incline", "inclinata inclinato"],
  ["decline", "declinata declinato"],
  ["flat", "piana piano"],
  ["bench", "panca panche"],
  ["bench press", "panca piana distensioni"],
  ["chest press", "spinte petto"],
  ["fly", "croci aperture"],
  ["butterfly", "croci pettorali"],
  ["crossover", "croci cavi"],
  ["squat", "accosciata"],
  ["deadlift", "stacchi stacco"],
  ["romanian", "rumeno rumeni"],
  ["lunge", "affondi"],
  ["leg press", "pressa gambe"],
  ["leg extension", "estensioni gambe"],
  ["leg curl", "flessioni gambe"],
  ["pull up", "trazioni sbarra"],
  ["pull-up", "trazioni sbarra"],
  ["chin up", "trazioni presa inversa"],
  ["pulldown", "trazioni lat machine"],
  ["push up", "piegamenti flessioni"],
  ["push-up", "piegamenti flessioni"],
  ["row", "rematore remata"],
  ["curl", "bicipiti"],
  ["hammer", "martello"],
  ["triceps", "tricipiti"],
  ["lateral raise", "alzate laterali"],
  ["front raise", "alzate frontali"],
  ["shoulder press", "spinte spalle"],
  ["military press", "lento avanti"],
  ["overhead press", "spinte spalle"],
  ["rear delt", "deltoidi posteriori"],
  ["hip thrust", "spinte bacino glutei"],
  ["glute bridge", "ponte glutei"],
  ["calf raise", "alzate polpacci"],
  ["shrug", "scrollate"],
  ["crunch", "addominali"],
  ["sit up", "addominali"],
  ["plank", "addominali"],
  ["dip", "parallele"],
  ["chest", "petto pettorali"],
  ["back", "schiena dorso dorsali"],
  ["shoulder", "spalle deltoidi"],
  ["biceps", "bicipiti"],
  ["glutes", "glutei"],
  ["quadriceps", "quadricipiti"],
  ["hamstrings", "femorali"],
  ["calves", "polpacci"],
  ["waist", "addome addominali"],
  ["abs", "addominali"],
  ["dumbbell", "manubri manubrio"],
  ["barbell", "bilanciere"],
  ["cable", "cavi cavo"],
  ["machine", "macchina macchinario"],
  ["body weight", "corpo libero"],
  ["band", "elastico"],
  ["seated", "seduto seduta"],
  ["standing", "in piedi"]
];

function gymNormalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}


function exerciseNameItalian(name) {
  let t = String(name || "").toLowerCase();

  const replacements = [
    ["reverse grip", "presa inversa"],
    ["close grip", "presa stretta"],
    ["wide grip", "presa larga"],
    ["neutral grip", "presa neutra"],
    ["one arm", "a un braccio"],
    ["single arm", "a un braccio"],
    ["one leg", "a una gamba"],
    ["single leg", "a una gamba"],
    ["behind neck", "dietro la nuca"],
    ["behind head", "dietro la testa"],
    ["bent over", "piegato in avanti"],
    ["overhead", "sopra la testa"],
    ["incline bench press", "panca inclinata"],
    ["decline bench press", "panca declinata"],
    ["bench press", "panca piana"],
    ["chest press", "spinte per il petto"],
    ["shoulder press", "spinte per le spalle"],
    ["military press", "lento avanti"],
    ["leg press", "pressa per le gambe"],
    ["leg extension", "estensione delle gambe"],
    ["leg curl", "leg curl"],
    ["lat pulldown", "lat machine"],
    ["pulldown", "lat machine"],
    ["pull-up", "trazioni"],
    ["pull up", "trazioni"],
    ["chin-up", "trazioni presa supina"],
    ["chin up", "trazioni presa supina"],
    ["push-up", "piegamenti"],
    ["push up", "piegamenti"],
    ["hip thrust", "spinta d'anca"],
    ["glute bridge", "ponte glutei"],
    ["calf raise", "alzata polpacci"],
    ["lateral raise", "alzata laterale"],
    ["front raise", "alzata frontale"],
    ["rear delt", "deltoide posteriore"],
    ["upright row", "tirata al mento"],
    ["bent over row", "rematore"],
    ["seated row", "rematore da seduto"],
    ["good morning", "good morning"],
    ["deadlift", "stacco"],
    ["romanian", "rumeno"],
    ["squat", "squat"],
    ["lunge", "affondo"],
    ["crunch", "crunch"],
    ["sit-up", "sit-up"],
    ["sit up", "sit-up"],
    ["plank", "plank"],
    ["side bend", "flessione laterale"],
    ["side plank", "plank laterale"],
    ["hip abduction", "abduzione dell'anca"],
    ["hip adduction", "adduzione dell'anca"],
    ["wrist curl", "flessione dei polsi"],
    ["bicep curl", "curl per bicipiti"],
    ["biceps curl", "curl per bicipiti"],
    ["triceps extension", "estensione tricipiti"],
    ["tricep extension", "estensione tricipiti"],
    ["triceps dip", "dip per tricipiti"],
    ["chest dip", "dip per il petto"],
    ["russian twist", "torsione russa"],
    ["leg raise", "sollevamento gambe"],
    ["knee raise", "sollevamento ginocchia"],
    ["calf press", "spinta polpacci"],
    ["hack squat", "hack squat"],
    ["front squat", "squat frontale"],
    ["sumo squat", "squat sumo"],
    ["split squat", "squat bulgaro"],
    ["sissy squat", "sissy squat"],

    ["smith machine", "Smith machine"],
    ["smith", "Smith machine"],
    ["barbell", "con bilanciere"],
    ["dumbbell", "con manubrio"],
    ["cable", "ai cavi"],
    ["band", "con elastico"],
    ["kettlebell", "con kettlebell"],
    ["weighted", "con sovraccarico"],
    ["assisted", "assistito"],
    ["bodyweight", "a corpo libero"],

    ["standing", "in piedi"],
    ["seated", "da seduto"],
    ["lying", "da sdraiato"],
    ["kneeling", "in ginocchio"],
    ["incline", "inclinato"],
    ["decline", "declinato"],
    ["reverse", "inverso"],
    ["close-grip", "presa stretta"],
    ["wide-grip", "presa larga"],
    ["wide", "largo"],
    ["narrow", "stretto"],
    ["single", "singolo"],
    ["alternating", "alternato"],

    ["shoulder", "spalla"],
    ["chest", "petto"],
    ["back", "schiena"],
    ["biceps", "bicipiti"],
    ["bicep", "bicipite"],
    ["triceps", "tricipiti"],
    ["tricep", "tricipite"],
    ["forearm", "avambraccio"],
    ["wrist", "polso"],
    ["hip", "anca"],
    ["glute", "gluteo"],
    ["hamstring", "femorale"],
    ["quadriceps", "quadricipite"],
    ["calves", "polpacci"],
    ["calf", "polpaccio"],
    ["leg", "gamba"],
    ["knee", "ginocchio"],
    ["neck", "collo"],

    ["raise", "alzata"],
    ["press", "spinta"],
    ["row", "rematore"],
    ["curl", "curl"],
    ["extension", "estensione"],
    ["stretch", "allungamento"],
    ["jump", "salto"],
    ["walk", "camminata"],
    ["walking", "camminata"],
    ["run", "corsa"],
    ["running", "corsa"],
    ["rotation", "rotazione"],
    ["twist", "torsione"],
    ["bridge", "ponte"],
    ["fly", "croci"],
    ["shrug", "scrollata"],
    ["dip", "dip"]
  ];

  for (const [en, it] of replacements) {
    const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp("\\b" + escaped + "\\b", "gi"), it);
  }

  t = t
    .replace(/\s+/g, " ")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s+/g, "(")
    .trim();

  if (!t) return "";

  return t.charAt(0).toUpperCase() + t.slice(1);
}

function exerciseSearchText(exercise) {

  const original = [
    exercise.name,
    exercise.category,
    exercise.body_part,
    exercise.target,
    exercise.muscle_group,
    exercise.equipment,
    ...(exercise.secondary_muscles || []),
    categoryLabel(exercise.category),
    equipmentLabel(exercise.equipment),
    muscleLabel(exercise.target)
  ].filter(Boolean).join(" ");

  const normalized = gymNormalize(original);
  const translations = [];

  for (const [english, italian] of gymItalianWords) {
    const word = gymNormalize(english);

    if (
      (" " + normalized + " ").includes(" " + word + " ") ||
      normalized.split(" ").some(part => part.startsWith(word))
    ) {
      translations.push(italian);
    }
  }

  return gymNormalize(original + " " + translations.join(" "));
}

function exerciseMatchesGroup(
  exercise
) {

  if (
    selectedGroup === "all"
  ) {

    return true;

  }


  const group =
    groups.find(
      item =>
        item.id ===
        selectedGroup
    );


  if (!group) {
    return true;
  }


  const haystack =
    exerciseSearchText(
      exercise
    );


  return group.words.some(
    word =>
      haystack.includes(
        word.toLowerCase()
      )
  );

}


function populateEquipment() {

  const list = [

    ...new Set(

      exercises
        .map(
          item =>
            item.equipment
        )
        .filter(Boolean)

    )

  ].sort();


  list.forEach(
    item => {

      const option =
        document.createElement(
          "option"
        );

      option.value = item;

      option.textContent =
        equipmentLabel(item);

      equipmentFilter
        .appendChild(option);

    }
  );

}


function getItalianSteps(
  exercise
) {

  const directSteps =
    exercise
      .instruction_steps
      ?.it;


  if (
    Array.isArray(directSteps)
    &&
    directSteps.length
  ) {

    return directSteps;

  }


  const text =
    exercise
      .instructions
      ?.it
    ||
    "";


  if (!text) {

    return [
      "Istruzioni non disponibili."
    ];

  }


  const matches =
    text.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    );


  if (!matches) {
    return [text];
  }


  return matches

    .map(
      sentence =>
        sentence.trim()
    )

    .filter(Boolean);

}


function shortDescription(
  exercise
) {

  const steps =
    getItalianSteps(
      exercise
    );


  if (!steps.length) {

    return (
      "Esercizio per "
      +
      muscleLabel(
        exercise.target
      )
      +
      "."
    );

  }


  let first =
    steps[0];


  if (
    first.length > 230
  ) {

    first =
      first.slice(
        0,
        227
      )
      +
      "...";

  }


  return first;

}


function staticMediaHtml(
  exercise
) {

  const image =
    mediaUrl(
      exercise.image
    );


  return `

    <div
      class="exercise-media"
      data-exercise-id="${escapeHtml(exercise.id)}"
      data-playing="false"
    >

      <img

        src="${image}"

        alt="${escapeHtml(exercise.name)}"

        loading="lazy"

      >


      <div class="play-button">
        ▶
      </div>


      <div class="tap-label">

        <span class="target-dot"></span>

        ${escapeHtml(
          muscleLabel(
            exercise.target
          )
        )}

      </div>

    </div>

  `;

}


function startMedia(
  container,
  exercise
) {

  stopActiveMedia();


  const gif =
    mediaUrl(
      exercise.gif_url
    );


  if (!gif) {
    return;
  }


  container.classList
    .add("playing");


  container.dataset.playing =
    "true";


  container.innerHTML = `

    <img

      src="${gif}?play=${Date.now()}"

      alt="${escapeHtml(exercise.name)}"

    >


    <div class="play-button">
      ❚❚
    </div>


    <div class="tap-label">

      MOVIMENTO ATTIVO

    </div>

  `;


  activeMedia = {

    container,

    exercise

  };

}


function stopMedia(
  container,
  exercise
) {

  container.classList
    .remove("playing");


  container.dataset.playing =
    "false";


  container.innerHTML = `

    <img

      src="${mediaUrl(exercise.image)}"

      alt="${escapeHtml(exercise.name)}"

      loading="lazy"

    >


    <div class="play-button">
      ▶
    </div>


    <div class="tap-label">

      <span class="target-dot"></span>

      ${escapeHtml(
        muscleLabel(
          exercise.target
        )
      )}

    </div>

  `;


  if (
    activeMedia
    &&
    activeMedia.container
      === container
  ) {

    activeMedia = null;

  }

}


function stopActiveMedia() {

  if (!activeMedia) {
    return;
  }


  const {
    container,
    exercise
  } = activeMedia;


  activeMedia = null;


  if (
    document.body.contains(
      container
    )
  ) {

    stopMedia(
      container,
      exercise
    );

  }

}


function toggleMedia(
  container,
  exercise
) {

  const isPlaying =
    container.dataset.playing
      === "true";


  if (isPlaying) {

    stopMedia(
      container,
      exercise
    );

  }

  else {

    startMedia(
      container,
      exercise
    );

  }

}


function filterExercises() {

  stopActiveMedia();


  const search = gymNormalize(searchInput.value);


  const selectedEquipment =
    equipmentFilter.value;


  filteredExercises =
    exercises.filter(
      exercise => {

        const searchMatch =

          !search

          ||

          search.split(" ").every(
            word => exerciseSearchText(exercise).includes(word)
          );


        const groupMatch =
          exerciseMatchesGroup(
            exercise
          );


        const equipmentMatch =

          selectedEquipment
            === "all"

          ||

          exercise.equipment
            === selectedEquipment;


        return (
          searchMatch
          &&
          groupMatch
          &&
          equipmentMatch
        );

      }
    );


  sortExercises();


  visibleCount = 40;


  renderExercises();

}


function sortExercises() {

  const direction =
    sortFilter.value;


  filteredExercises.sort(
    (a, b) => {

      const result =
        a.name.localeCompare(
          b.name,
          undefined,
          {
            sensitivity:
              "base"
          }
        );


      return (
        direction === "za"
        ? -result
        : result
      );

    }
  );

}


function renderExercises() {

  stopActiveMedia();


  const visible =
    filteredExercises
      .slice(
        0,
        visibleCount
      );


  exerciseCount.textContent =
    `${filteredExercises.length} esercizi`;


  exerciseGrid.innerHTML =

    visible
      .map(
        exercise => `

          <article
            class="exercise-card"
            data-id="${escapeHtml(exercise.id)}"
          >

            ${staticMediaHtml(exercise)}


            <div class="card-body">

              <div class="category">

                ${escapeHtml(
                  categoryLabel(
                    exercise.category
                  )
                )}

              </div>


              <h3>

                ${escapeHtml(
                  exercise.name
                )} <span style="font-weight:500;opacity:.72;text-transform:none">— ${escapeHtml(exerciseNameItalian(exercise.name))}</span>

              </h3>


              <div class="target">

                <span class="red"></span>

                ${escapeHtml(
                  muscleLabel(
                    exercise.target
                  )
                )}

              </div>


              <div class="exercise-actions">

                <button
                  class="details-button"
                  data-detail-id="${escapeHtml(exercise.id)}"
                >
                  VEDI SCHEDA
                </button>

                <button
                  type="button"
                  class="gg-add-workout"
                  data-exercise-id="${escapeHtml(exercise.id)}"
                  data-exercise-name="${escapeHtml(exercise.name)}"
                  onclick="window.GymGiuseWorkout && window.GymGiuseWorkout.addFromButton(this); return false;"
                >
                  + AGGIUNGI
                </button>

              </div>

            </div>

          </article>

        `
      )
      .join("");


  emptyState.classList
    .toggle(
      "hidden",
      filteredExercises.length
        !== 0
    );


  loadMore.classList
    .toggle(
      "hidden",
      visibleCount
        >=
      filteredExercises.length
    );

}


function openExercise(
  exercise
) {

  stopActiveMedia();


  document
    .getElementById(
      "modalMedia"
    )
    .innerHTML =
      staticMediaHtml(
        exercise
      );


  document
    .getElementById(
      "modalMuscle"
    )
    .innerHTML = `

      <span
        class="target-dot"
      ></span>

      ${escapeHtml(
        muscleLabel(
          exercise.target
        )
      )}

    `;


  document
    .getElementById(
      "modalTitle"
    )
    .textContent =
      exercise.name + " — " + exerciseNameItalian(exercise.name);


  document
    .getElementById(
      "modalDescription"
    )
    .textContent =
      shortDescription(
        exercise
      );


  document
    .getElementById(
      "modalTarget"
    )
    .textContent =
      muscleLabel(
        exercise.target
      );


  document
    .getElementById(
      "modalEquipment"
    )
    .textContent =
      equipmentLabel(
        exercise.equipment
      );


  document
    .getElementById(
      "modalCategory"
    )
    .textContent =
      categoryLabel(
        exercise.category
      );


  const steps =
    getItalianSteps(
      exercise
    );


  document
    .getElementById(
      "modalInstructions"
    )
    .innerHTML =

      steps
        .map(
          step => `

            <li>
              ${escapeHtml(step)}
            </li>

          `
        )
        .join("");


  const secondary =
    exercise
      .secondary_muscles
    ||
    [];


  document
    .getElementById(
      "secondaryMuscles"
    )
    .innerHTML =

      secondary.length

      ?

      secondary
        .map(
          muscle => `

            <span>
              ${escapeHtml(
                muscleLabel(
                  muscle
                )
              )}
            </span>

          `
        )
        .join("")

      :

      `<span>
        Nessuno indicato
      </span>`;


  document
    .getElementById(
      "exerciseModal"
    )
    .classList
    .remove("hidden");


  document.body.style.overflow =
    "hidden";

}



window.GymGiuseExerciseMedia = function(id) {
  const exercise = exercises.find(item => String(item.id) === String(id));
  if (!exercise) return null;

  return {
    image: mediaUrl(exercise.image),
    gif: mediaUrl(exercise.gif_url)
  };
};

window.GymGiuseOpenExerciseById = function(id) {
  const exercise = exercises.find(item => String(item.id) === String(id));
  if (!exercise) return;
  openExercise(exercise);
};

function closeExercise() {


  stopActiveMedia();


  document
    .getElementById(
      "exerciseModal"
    )
    .classList
    .add("hidden");


  document.body.style.overflow =
    "";

}


async function loadExercises() {

  try {

    const response =
      await fetch(
        DATA_URL
      );


    if (!response.ok) {

      throw new Error(
        "Errore caricamento"
      );

    }


    exercises =
      await response.json();


    populateEquipment();


    filteredExercises =
      [...exercises];


    sortExercises();


    loading.classList
      .add("hidden");


    renderExercises();

  }

  catch (error) {

    console.error(
      error
    );


    loading.innerHTML = `

      <strong>
        Non riesco a caricare gli esercizi.
      </strong>

      <p
        style="
          margin-top:8px;
          line-height:1.5;
        "
      >
        Controlla la connessione
        e ricarica la pagina.
      </p>

    `;

  }

}


renderGroupFilters();


muscleFilters
  .addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          ".muscle-filter"
        );


      if (!button) {
        return;
      }


      document
        .querySelectorAll(
          ".muscle-filter"
        )
        .forEach(
          item =>
            item.classList
              .remove(
                "active"
              )
        );


      button.classList
        .add("active");


      selectedGroup =
        button.dataset.group;


      filterExercises();

    }
  );


searchInput
  .addEventListener(
    "input",
    filterExercises
  );


equipmentFilter
  .addEventListener(
    "change",
    filterExercises
  );


sortFilter
  .addEventListener(
    "change",
    () => {

      sortExercises();

      visibleCount = 40;

      renderExercises();

    }
  );


loadMore
  .addEventListener(
    "click",
    () => {

      visibleCount += 40;

      renderExercises();

    }
  );


exerciseGrid
  .addEventListener(
    "click",
    event => {

      const media =
        event.target.closest(
          ".exercise-media"
        );


      if (media) {

        event.preventDefault();

        event.stopPropagation();


        const exercise =
          exercises.find(
            item =>
              item.id
              ===
              media.dataset
                .exerciseId
          );


        if (exercise) {

          toggleMedia(
            media,
            exercise
          );

        }


        return;

      }


      const detailButton =
        event.target.closest(
          ".details-button"
        );


      if (detailButton) {

        const exercise =
          exercises.find(
            item =>
              item.id
              ===
              detailButton.dataset
                .detailId
          );


        if (exercise) {

          openExercise(
            exercise
          );

        }

      }

    }
  );


document
  .getElementById(
    "modalMedia"
  )
  .addEventListener(
    "click",
    event => {

      const media =
        event.target.closest(
          ".exercise-media"
        );


      if (!media) {
        return;
      }


      const exercise =
        exercises.find(
          item =>
            item.id
            ===
            media.dataset
              .exerciseId
        );


      if (exercise) {

        toggleMedia(
          media,
          exercise
        );

      }

    }
  );


document
  .getElementById(
    "closeModal"
  )
  .addEventListener(
    "click",
    closeExercise
  );


document
  .getElementById(
    "modalBackground"
  )
  .addEventListener(
    "click",
    closeExercise
  );


document
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key
        ===
        "Escape"
      ) {

        closeExercise();

      }

    }
  );


loadExercises();

/* Modulo scheda spostato in workout.js */
