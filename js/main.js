const startButton =
    document.getElementById("start-button");

const navbar =
    document.querySelector(".navbar");

const myThingsSection =
    document.getElementById("my-things");


const nameInput =
    document.getElementById("thing-name");

const reasonInput =
    document.getElementById("thing-reason");


const categoryButtons =
    document.querySelectorAll(".category-button");


const addThingButton =
    document.getElementById("add-thing-button");


const inspirationToggle =
    document.getElementById("inspiration-toggle");

const inspirationBox =
    document.getElementById("inspiration-box");


const thingsList =
    document.getElementById("things-list");

const thingsCount =
    document.getElementById("things-count");


const findPatternButton =
    document.getElementById("find-pattern-button");


let selectedCategory = "";

let things = [];


/* =========================
   START
========================= */

startButton.addEventListener(
    "click",
    function () {

        const navbarHeight =
            navbar.offsetHeight;


        const targetY =
            myThingsSection
                .getBoundingClientRect()
                .top
            +
            window.scrollY
            -
            navbarHeight;


        window.scrollTo({
            top: targetY,
            behavior: "smooth"
        });

    }
);


/* =========================
   CATEGORY
========================= */

categoryButtons.forEach(
    function (button) {

        button.addEventListener(
            "click",
            function () {

                categoryButtons.forEach(
                    function (otherButton) {

                        otherButton
                            .classList
                            .remove("selected");

                    }
                );


                button
                    .classList
                    .add("selected");


                selectedCategory =
                    button.dataset.category;

            }
        );

    }
);


/* =========================
   INSPIRATION
========================= */

inspirationToggle.addEventListener(
    "click",
    function () {

        inspirationBox
            .classList
            .toggle("hidden");

    }
);


/* =========================
   ADD THING
========================= */

addThingButton.addEventListener(
    "click",
    function () {

        const name =
            nameInput
                .value
                .trim();


        const reason =
            reasonInput
                .value
                .trim();


        if (name === "") {

            alert(
                "좋아하는 것을 하나 입력해주세요."
            );

            return;

        }


        const thing = {
            name: name,
            category: selectedCategory,
            reason: reason
        };


        things.push(thing);


        nameInput.value = "";

        reasonInput.value = "";

        selectedCategory = "";


        categoryButtons.forEach(
            function (button) {

                button
                    .classList
                    .remove("selected");

            }
        );


        renderThings();

    }
);


/* =========================
   RENDER THINGS
========================= */

function renderThings() {

    thingsList.innerHTML = "";


    things.forEach(
        function (thing, index) {

            const card =
                document.createElement("div");


            card
                .classList
                .add("thing-card");


            const categoryText =
                thing.category === ""
                    ? "자유"
                    : thing.category;


            card.innerHTML = `
                <button
                    class="remove-button"
                    data-index="${index}"
                    type="button"
                >
                    ×
                </button>

                <span class="thing-card-category">
                    ${categoryText}
                </span>

                <h4>
                    ${thing.name}
                </h4>

                ${
                    thing.reason
                        ? `
                            <p class="thing-card-reason">
                                ${thing.reason}
                            </p>
                        `
                        : ""
                }
            `;


            thingsList.appendChild(card);

        }
    );


    thingsCount.textContent =
        `${things.length} things collected.`;


    if (things.length >= 3) {

        findPatternButton.disabled =
            false;

    } else {

        findPatternButton.disabled =
            true;

    }


    const removeButtons =
        document.querySelectorAll(
            ".remove-button"
        );


    removeButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const index =
                        Number(
                            button.dataset.index
                        );


                    things.splice(
                        index,
                        1
                    );


                    renderThings();

                }
            );

        }
    );

}


/* =========================
   ENTER KEY
========================= */

nameInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {

            addThingButton.click();

        }

    }
);


/* =========================
   FIND MY PATTERN
========================= */

findPatternButton.addEventListener(
    "click",
    function () {

        console.log(
            "사용자의 취향 데이터:"
        );


        console.log(
            things
        );


        alert(
            "다음 단계에서 이 데이터를 AI에게 보내 PATTERN을 만들 거예요."
        );

    }
);