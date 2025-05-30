document.addEventListener("DOMContentLoaded", async function () {
    // Display the loading indicator
    const loadingIndicator = document.getElementById("loading");
    loadingIndicator.style.display = "block";

    let setLocationCategory = "Netmiss";

    let setBaseUrl = null;
    if (cda === "internal") {
        setBaseUrl = `https://wm.${office.toLowerCase()}.ds.usace.army.mil/${office.toLowerCase()}-data/`;
    } else if (cda === "public") {
        setBaseUrl = `https://cwms-data.usace.army.mil/cwms-data/`;
    }
    console.log("setBaseUrl: ", setBaseUrl);

    const apiUrl = setBaseUrl + `location/group?office=${office}&group-office-id=${office}&category-office-id=${office}&category-id=${setLocationCategory}`;
    console.log("apiUrl: ", apiUrl);

    const netmissTsidMap = new Map();
    const metadataMap = new Map();

    const metadataPromises = [];
    const netmissTsidPromises = [];

    // Get current date and time
    const currentDateTime = new Date();
    // console.log('currentDateTime:', currentDateTime);

    // Subtract thirty hours from current date and time
    const currentDateTimeMinus30Hours = subtractHoursFromDate(currentDateTime, 30);
    console.log('currentDateTimeMinus30Hours :', currentDateTimeMinus30Hours);

    // Subtract thirty hours from current date and time
    const currentDateTimeMinus00Hours = subtractHoursFromDate(currentDateTime, 0);
    console.log('currentDateTimeMinus00Hours :', currentDateTimeMinus00Hours);

    const currentDateTimePlus190Hours = addHoursFromDate(currentDateTime, 190);
    console.log('currentDateTimePlus190Hours :', currentDateTimePlus190Hours);

    fetch(apiUrl)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then((data) => {
            if (!Array.isArray(data) || data.length === 0) {
                console.warn("No data available from the initial fetch.");
                return;
            }

            const targetCategory = { "office-id": office, id: setLocationCategory };
            const filteredArray = filterByLocationCategory(data, targetCategory);
            const basins = filteredArray.map((item) => item.id);
            if (basins.length === 0) {
                console.warn("No basins found for the given setLocationCategory.");
                return;
            }

            const apiPromises = [];
            const combinedData = [];

            basins.forEach((basin) => {
                const basinApiUrl = setBaseUrl + `location/group/${basin}?office=${office}&category-id=${setLocationCategory}`;
                console.log("basinApiUrl: ", basinApiUrl);

                apiPromises.push(
                    fetch(basinApiUrl)
                        .then((response) => {
                            if (!response.ok) {
                                throw new Error(
                                    `Network response was not ok for basin ${basin}: ${response.statusText}`
                                );
                            }
                            return response.json();
                        })
                        .then((basinData) => {
                            // console.log('basinData:', basinData);

                            if (!basinData) {
                                console.log(`No data for basin: ${basin}`);
                                return;
                            }

                            basinData[`assigned-locations`] = basinData[
                                `assigned-locations`
                            ].filter((location) => location.attribute <= 900);
                            basinData[`assigned-locations`].sort(
                                (a, b) => a.attribute - b.attribute
                            );
                            combinedData.push(basinData);

                            if (basinData["assigned-locations"]) {
                                basinData["assigned-locations"].forEach((loc) => {
                                    let netmissTsidApiUrl = setBaseUrl + `timeseries/group/Stage?office=${office}&category-id=${loc["location-id"]}`;
                                    if (netmissTsidApiUrl) {
                                        netmissTsidPromises.push(
                                            fetch(netmissTsidApiUrl)
                                                .then((response) => {
                                                    if (response.status === 404) {
                                                        return null; // Skip processing if no data is found
                                                    }
                                                    if (!response.ok) {
                                                        throw new Error(
                                                            `Network response was not ok: ${response.statusText}`
                                                        );
                                                    }
                                                    return response.json();
                                                })
                                                .then((netmissTsidData) => {
                                                    // console.log('netmissTsidData:', netmissTsidData);

                                                    // Extract the dynamic part from time-series-category
                                                    let dynamicId = netmissTsidData["time-series-category"]["id"];

                                                    // Create the new timeseries-ids dynamically
                                                    let newTimeseriesId = null;

                                                    // console.log(loc["location-id"]);

                                                    if (dynamicId === "LD 24 Pool-Mississippi" || dynamicId === "LD 25 Pool-Mississippi" || dynamicId === "Mel Price Pool-Mississippi") {
                                                        newTimeseriesId = `${dynamicId}.Elev.Inst.~1Day.0.netmiss-fcst`;
                                                    } else {
                                                        newTimeseriesId = `${dynamicId}.Stage.Inst.~1Day.0.netmiss-fcst`;
                                                    }
                                                    // New object to append for the first timeseries-id
                                                    let newAssignedTimeSeries = {
                                                        "office-id": "MVS",
                                                        "timeseries-id": newTimeseriesId, // Use dynamic timeseries-id
                                                        "ts-code": null,
                                                        attribute: 2,
                                                    };

                                                    // Append both new objects to assigned-time-series
                                                    netmissTsidData["assigned-time-series"].push(
                                                        newAssignedTimeSeries
                                                    );

                                                    // console.log("netmissTsidData: ", netmissTsidData);

                                                    if (netmissTsidData) {
                                                        netmissTsidMap.set(loc["location-id"], netmissTsidData);
                                                    }
                                                })
                                                .catch((error) => {
                                                    console.error(
                                                        `Problem with the fetch operation for stage TSID data at ${netmissTsidApiUrl}:`,
                                                        error
                                                    );
                                                })
                                        );
                                    } else {
                                    }

                                    // Construct the URL for the location metadata request
                                    let locApiUrl = setBaseUrl + `locations/${loc["location-id"]}?office=${office}`;
                                    if (locApiUrl) {
                                        // Push the fetch promise to the metadataPromises array
                                        metadataPromises.push(
                                            fetch(locApiUrl)
                                                .then((response) => {
                                                    if (response.status === 404) {
                                                        console.warn(
                                                            `Location metadata not found for location: ${loc["location-id"]}`
                                                        );
                                                        return null; // Skip processing if no metadata is found
                                                    }
                                                    if (!response.ok) {
                                                        throw new Error(
                                                            `Network response was not ok: ${response.statusText}`
                                                        );
                                                    }
                                                    return response.json();
                                                })
                                                .then((locData) => {
                                                    if (locData) {
                                                        metadataMap.set(loc["location-id"], locData);
                                                    }
                                                })
                                                .catch((error) => {
                                                    console.error(
                                                        `Problem with the fetch operation for location ${loc["location-id"]}:`,
                                                        error
                                                    );
                                                })
                                        );
                                    }

                                });
                            }
                        })
                        .catch((error) => {
                            console.error(
                                `Problem with the fetch operation for basin ${basin}:`,
                                error
                            );
                        })
                );
            });

            Promise.all(apiPromises)
                .then(() => Promise.all(netmissTsidPromises))
                .then(() => {
                    combinedData.forEach((basinData) => {
                        if (basinData["assigned-locations"]) {
                            basinData["assigned-locations"].forEach((loc) => {
                                const netmissTsidMapData = netmissTsidMap.get(
                                    loc["location-id"]
                                );
                                // console.log('netmissTsidMapData:', netmissTsidMapData);

                                reorderByAttribute(netmissTsidMapData);
                                if (netmissTsidMapData) {
                                    loc["tsid-netmiss"] = netmissTsidMapData;
                                }

                                const metadataMapData = metadataMap.get(loc["location-id"]);
                                if (metadataMapData) {
                                    loc["metadata"] = metadataMapData;
                                }
                            });
                        }
                    });

                    console.log('combinedData:', combinedData);
                })
                .then(() => {
                    // Append NWS 5 digits codes
                    combinedData.forEach((dataObj, index) => {
                        // Ensure 'assigned-locations' exists and is an array
                        if (Array.isArray(dataObj["assigned-locations"])) {
                            // Iterate through the assigned locations
                            dataObj["assigned-locations"].forEach((location) => {
                                // Check if the location-id matches 'Cape Girardeau-Mississippi'
                                if (location["location-id"] === "Cape Girardeau-Mississippi") {
                                    location["NWS"] = "CPGM7";
                                } else if (
                                    location["location-id"] === "LD 24 TW-Mississippi" ||
                                    location["location-id"] === "LD 24 Pool-Mississippi"
                                ) {
                                    location["NWS"] = "CLKM7";
                                } else if (
                                    location["location-id"] === "LD 25 TW-Mississippi" ||
                                    location["location-id"] === "LD 25 Pool-Mississippi"
                                ) {
                                    location["NWS"] = "CAGM7";
                                } else if (
                                    location["location-id"] === "Mel Price TW-Mississippi" ||
                                    location["location-id"] === "Mel Price Pool-Mississippi"
                                ) {
                                    location["NWS"] = "ALNI2";
                                } else if (location["location-id"] === "St Louis-Mississippi") {
                                    location["NWS"] = "EADM7";
                                } else if (location["location-id"] === "Chester-Mississippi") {
                                    location["NWS"] = "CHSI2";
                                } else if (
                                    location["location-id"] === "Cape Girardeau-Mississippi"
                                ) {
                                    location["NWS"] = "CPGM7";
                                } else {
                                    location["NWS"] = "Your default string here"; // Optionally, assign a default value for other locations
                                }
                            });
                        } else {
                            console.warn(
                                `Skipping dataObj at index ${index} as 'assigned-locations' is not a valid array.`
                            );
                        }
                    });
                    console.log("combinedData with NWS Code: ", combinedData);

                    // Append the table to the specified container
                    const container = document.getElementById("table_container");
                    const table = createParagraphs(combinedData);
                    container.appendChild(table);
                    // createParagraphsPhp(combinedData);

                    loadingIndicator.style.display = "none";
                })
                .catch((error) => {
                    console.error(
                        "There was a problem with one or more fetch operations:",
                        error
                    );
                    loadingIndicator.style.display = "none";
                });
        })
        .catch((error) => {
            console.error(
                "There was a problem with the initial fetch operation:",
                error
            );
            loadingIndicator.style.display = "none";
        });

    function filterByLocationCategory(array, setLocationCategory) {
        return array.filter(
            (item) =>
                item["location-category"] &&
                item["location-category"]["office-id"] === setLocationCategory["office-id"] &&
                item["location-category"]["id"] === setLocationCategory["id"]
        );
    }

    function subtractHoursFromDate(date, hoursToSubtract) {
        return new Date(date.getTime() - hoursToSubtract * 60 * 60 * 1000);
    }

    function formatNWSDate(timestamp) {
        const date = new Date(timestamp);
        const mm = String(date.getMonth() + 1).padStart(2, "0"); // Month
        const dd = String(date.getDate()).padStart(2, "0"); // Day
        const yyyy = date.getFullYear(); // Year
        const hh = String(date.getHours()).padStart(2, "0"); // Hours
        const min = String(date.getMinutes()).padStart(2, "0"); // Minutes
        return `${mm}-${dd}-${yyyy} ${hh}:${min}`;
    }

    function addHoursFromDate(date, hoursToSubtract) {
        return new Date(date.getTime() + hoursToSubtract * 60 * 60 * 1000);
    }

    const reorderByAttribute = (data) => {
        data["assigned-time-series"].sort((a, b) => a.attribute - b.attribute);
    };

    const formatTime = (date) => {
        const pad = (num) => (num < 10 ? "0" + num : num);
        return `${pad(date.getMonth() + 1)}-${pad(
            date.getDate()
        )}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const findValuesAtTimes = (data) => {
        console.log("data: ", data);

        const result = [];
        const currentDate = new Date();

        // Create time options for 5 AM, 6 AM, and 7 AM today in Central Standard Time
        const timesToCheck = [
            new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate(),
                6,
                0
            ), // 6 AM CST
            new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate(),
                5,
                0
            ), // 5 AM CST
            new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate(),
                7,
                0
            ), // 7 AM CST
        ];

        const foundValues = [];

        // Iterate over the values in the provided data
        const values = data.values;

        // Check for each time in the order of preference
        timesToCheck.forEach((time) => {
            // Format the date-time to match the format in the data
            const formattedTime = formatTime(time);

            const entry = values.find((v) => v[0] === formattedTime);
            if (entry) {
                foundValues.push({ time: formattedTime, value: entry[1] }); // Store both time and value if found
            } else {
                foundValues.push({ time: formattedTime, value: null }); // Store null if not found
            }
        });

        // Push the result for this data entry
        result.push({
            name: data.name,
            values: foundValues, // This will contain the array of { time, value } objects
        });

        return result;
    };

    function getValidValue(values) {
        // Get the first non-null value from the values array
        const validValue = values.find((valueEntry) => valueEntry.value !== null);
        return validValue ? validValue.value.toFixed(1) : "N/A";
    }

    function getValidTime(data) {
        // Get the first non-null value from the data array
        const validTime = data.find((timeEntry) => timeEntry.time !== null);
        return validTime ? validTime.time : "N/A";
    }

    function formatDate(inputDate) {
        // Convert to Date object (assuming the format is MM-DD-YYYY HH:mm)
        const date = new Date(
            inputDate.replace(/(\d{2})-(\d{2})-(\d{4})/, "$2/$1/$3")
        );

        // Extract year, month, and day
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0"); // Month is 0-indexed
        const day = String(date.getDate()).padStart(2, "0");

        // Format the result as YYYYMMDD
        return `${year}${month}${day}`;
    }

    function createParagraphs(data) {
        // Replace this with the ID or class of the container where paragraphs should go
        const container = document.getElementById("paragraphs_container"); // or use querySelector for other selectors

        console.log("data: ", data);

        data.forEach((entry) => {
            entry["assigned-locations"].forEach((location) => {

                const stageTsid = location["tsid-netmiss"]["assigned-time-series"][0]["timeseries-id"];
                const netmissTsid = location["tsid-netmiss"]["assigned-time-series"][1]["timeseries-id"];
                console.log("stageTsidData: ", stageTsid);
                console.log("netmissTsidData: ", netmissTsid);

                const stageApiUrl = `${setBaseUrl}timeseries?name=${stageTsid}&begin=${currentDateTimeMinus30Hours.toISOString()}&end=${currentDateTimeMinus00Hours.toISOString()}&office=${office}`;
                const netmissApiUrl = `${setBaseUrl}timeseries?name=${netmissTsid}&begin=${currentDateTimeMinus00Hours.toISOString()}&end=${currentDateTimePlus190Hours.toISOString()}&office=${office}`;

                // Fetch stage data
                fetch(stageApiUrl)
                    .then((response) => response.json())
                    .then((stageData) => {
                        console.log("Stage API Data: ", stageData);
                        // process stageData here if needed
                    })
                    .catch((error) => console.error("Error fetching stage data:", error));

                // Fetch netmiss data
                fetch(netmissApiUrl)
                    .then((response) => response.json())
                    .then((netmissData) => {
                        console.log("Netmiss API Data: ", netmissData);
                        // process netmissData here if needed
                    })
                    .catch((error) => console.error("Error fetching netmiss data:", error));
            });
        });


        





        // // Loop through the data and create a <span> tag for each entry
        // data.forEach((entry) => {
        //     entry["assigned-locations"].forEach((location) => {
        //         const nws = location["NWS"];
        //         const locationId = location["location-id"];
        //         const stageValue = getValidValue(
        //             location.stageDataPreferredTimes[0].values
        //         );
        //         const stageTime = formatDateYYYYMMDD(
        //             location.stageDataPreferredTimes[0].values[0]["time"]
        //         );

        //         // const logTheLocation = `********* ${locationId}`;
        //         const logTheLocation = ``;

        //         // Create a span element and append the data
        //         const span = document.createElement("span");
        //         if (
        //             locationId === "LD 24 Pool-Mississippi" ||
        //             locationId === "LD 25 Pool-Mississippi" ||
        //             locationId === "Mel Price Pool-Mississippi"
        //         ) {
        //             span.textContent = `.A ${nws} ${stageTime} Z DH1200/HP ${stageValue} ${logTheLocation}`;
        //         } else if (
        //             locationId === "LD 24 TW-Mississippi" ||
        //             locationId === "LD 25 TW-Mississippi" ||
        //             locationId === "Mel Price TW-Mississippi"
        //         ) {
        //             span.textContent = `.A ${nws} ${stageTime} Z DH1200/HT ${stageValue} ${logTheLocation}`;
        //         } else {
        //             span.textContent = `.A ${nws} ${stageTime} Z DH1200/HG ${stageValue} ${logTheLocation}`;
        //         }
        //         // Append the span to the container
        //         container.appendChild(span);

        //         // Create a line break and append it after the span
        //         const lineBreak = document.createElement("br");
        //         container.appendChild(lineBreak);
        //     });
        // });

        // Create a line break and append it after the span
        const lineBreak = document.createElement("br");
        container.appendChild(lineBreak);

        // // Loop through the data and create a <span> tag for each entry
        // data.forEach((entry) => {
        //     entry["assigned-locations"].forEach((location) => {
        //         const nws = location["NWS"];
        //         const nextDayForecastTime = formatDateYYYYMMDD(
        //             location.netmissData.values[0][0]
        //         );
        //         const netmissForecastValues = location.netmissData.values
        //             .slice(0, 7) // Get only the first 7 values
        //             .map((item) => item[1].toFixed(2)) // Format the numbers to two decimals
        //             .join("/"); // Join the values with a forward slash
        //         const locationId = location["location-id"];

        //         console.log(netmissForecastValues);

        //         // const logTheLocation = `********* ${locationId}`;
        //         const logTheLocation = ``;

        //         // Create a span element and append the data
        //         const span = document.createElement("span");
        //         if (
        //             locationId === "LD 24 Pool-Mississippi" ||
        //             locationId === "LD 25 Pool-Mississippi" ||
        //             locationId === "Mel Price Pool-Mississippi"
        //         ) {
        //             span.textContent = `.ER ${nws} ${nextDayForecastTime} Z DH1200/HPIF/DID1/${netmissForecastValues} ${logTheLocation}`;
        //         } else if (
        //             locationId === "LD 24 TW-Mississippi" ||
        //             locationId === "LD 25 TW-Mississippi" ||
        //             locationId === "Mel Price TW-Mississippi"
        //         ) {
        //             span.textContent = `.ER ${nws} ${nextDayForecastTime} Z DH1200/HTIF/DID1/${netmissForecastValues} ${logTheLocation}`;
        //         } else {
        //             span.textContent = `.ER ${nws} ${nextDayForecastTime} Z DH1200/HGIF/DID1/${netmissForecastValues} ${logTheLocation}`;
        //         }
        //         // Append the span to the container
        //         container.appendChild(span);

        //         // Create a line break and append it after the span
        //         const lineBreak = document.createElement("br");
        //         container.appendChild(lineBreak);
        //     });
        // });

        // Create a <p> element for the blank space at the top
        const blankSpace = document.createElement("p");

        // Create a <p> element for the link
        const p = document.createElement("p");
        const link = document.createElement("a");
        link.href = "shef.txt";
        link.textContent = "Click here for the NetMiss Shef Data";
        link.target = "_blank"; // Open in a new tab
        p.appendChild(link);

        // Create a <p> element for the link
        const p2 = document.createElement("p");
        const link2 = document.createElement("a");
        link2.href = "https://www.mvs-wc.usace.army.mil/netmiss_shef.txt";
        link2.textContent =
            "Click here for the NetMiss Shef Data (Public Web Link)";
        link2.target = "_blank"; // Open in a new tab
        p2.appendChild(link2);

        // Append the blank space and the <p> tags with the link to the container
        container.appendChild(blankSpace); // Add the blank space at the top
        container.appendChild(p);
        container.appendChild(p2);

        return container;
    }

    function createParagraphsPhp(data) {
        // Prepare data to send to PHP
        const paragraphsData = [];

        // Loop through the data and create paragraph text for stageData
        data.forEach((entry) => {
            entry["assigned-locations"].forEach((location) => {
                const nws = location["NWS"];
                const locationId = location["location-id"];
                const stageValue = getValidValue(
                    location.stageDataPreferredTimes[0].values
                );
                const stageTime = formatDateYYYYMMDD(
                    location.stageDataPreferredTimes[0].values[0]["time"]
                );

                // const logTheLocation = `********* ${locationId}`;
                const logTheLocation = ``;

                let paragraphText = "";
                if (
                    locationId === "LD 24 Pool-Mississippi" ||
                    locationId === "LD 25 Pool-Mississippi" ||
                    locationId === "Mel Price Pool-Mississippi"
                ) {
                    paragraphText = `.ER ${nws} ${stageTime} Z DH1200/HP ${stageValue} ${logTheLocation}`;
                } else if (
                    locationId === "LD 24 TW-Mississippi" ||
                    locationId === "LD 25 TW-Mississippi" ||
                    locationId === "Mel Price TW-Mississippi"
                ) {
                    paragraphText = `.ER ${nws} ${stageTime} Z DH1200/HT ${stageValue} ${logTheLocation}`;
                } else {
                    paragraphText = `.ER ${nws} ${stageTime} Z DH1200/HG ${stageValue} ${logTheLocation}`;
                }

                paragraphsData.push(paragraphText);
            });
        });

        // Add a blank line after the first loop
        paragraphsData.push(""); // This blank line will be added after the stageData loop

        // Loop through the data for netmissData
        data.forEach((entry) => {
            entry["assigned-locations"].forEach((location) => {
                const nws = location["NWS"];
                const nextDayForecastTime = formatDateYYYYMMDD(
                    location.netmissData.values[0][0]
                );
                const netmissForecastValues = location.netmissData.values
                    .slice(0, 7) // Get only the first 7 values
                    .map((item) => item[1].toFixed(2)) // Format the numbers to two decimals
                    .join("/"); // Join the values with a forward slash
                const locationId = location["location-id"];
                const logTheLocation = ``;

                let netmissText = "";
                if (
                    locationId === "LD 24 Pool-Mississippi" ||
                    locationId === "LD 25 Pool-Mississippi" ||
                    locationId === "Mel Price Pool-Mississippi"
                ) {
                    netmissText = `.ER ${nws} ${nextDayForecastTime} Z DH1200/HPIF/DID1/${netmissForecastValues} ${logTheLocation}`;
                } else if (
                    locationId === "LD 24 TW-Mississippi" ||
                    locationId === "LD 25 TW-Mississippi" ||
                    locationId === "Mel Price TW-Mississippi"
                ) {
                    netmissText = `.ER ${nws} ${nextDayForecastTime} Z DH1200/HTIF/DID1/${netmissForecastValues} ${logTheLocation}`;
                } else {
                    netmissText = `.ER ${nws} ${nextDayForecastTime} Z DH1200/HGIF/DID1/${netmissForecastValues} ${logTheLocation}`;
                }

                paragraphsData.push(netmissText);
            });
        });

        // Add a blank line after the second loop
        paragraphsData.push(""); // This blank line will be added after the netmissData loop

        // Use CDA to write a file to a BLOB
        // NOTE: https://cwms-data.usace.army.mil/cwms-data/blobs/NETMISS_SHEF.TXT?office=MVS
        // curl -O https://cwms-data.usace.army.mil/cwms-data/blobs/NETMISS_SHEF.TXT?office=MVS
        /*
        fetch(`${setBaseUrl.replace(":8243", "")}blobs?fail-if-exists=false`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json;version=2",
            "cache-control": "no-cache",
          },
          body: JSON.stringify({
            "office-id": office,
            "media-type-id": "application/octet-stream",
            "id": "NETMISS_SHEF.TXT",
            "description": `Updated ${moment().format()}`,
            "value": btoa(paragraphsData),
          }),
        });
        */

        // Send the paragraphs data to the PHP script using fetch

        fetch("save_paragraphs.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ paragraphs: paragraphsData }), // Send paragraphs data as a JSON object
        })
            .then((response) => response.json())
            .then((result) => {
                console.log("Success:", result);
                alert("Data saved successfully!");
            })
            .catch((error) => {
                console.error("Error:", error);
                alert("Error saving data");
            });

    }

    function formatDateYYYYMMDD(timestamp) {
        let [date, time] = timestamp.split(" ");
        let [month, day, year] = date.split("-");
        return `${year}${month}${day}`;
    }

    function formatDateYYYYDDMM(timestamp) {
        let [date, time] = timestamp.split(" ");
        let [month, day, year] = date.split("-");
        return `${year}${month}${day}`;
    }

    function convertUnixTimestamp(timestamp, toCST = false) {
        if (typeof timestamp !== "number") {
            console.error("Invalid timestamp:", timestamp);
            return "Invalid Date";
        }
    
        const dateUTC = new Date(timestamp); // Convert milliseconds to Date object
        if (isNaN(dateUTC.getTime())) {
            console.error("Invalid date conversion:", timestamp);
            return "Invalid Date";
        }
    
        if (!toCST) {
            return dateUTC.toISOString(); // Return UTC time
        }
    
        // Convert to CST/CDT (America/Chicago) while adjusting for daylight saving time
        const options = { timeZone: "America/Chicago", hour12: false };
        const cstDateString = dateUTC.toLocaleString("en-US", options);
        const cstDate = new Date(cstDateString + " UTC"); // Convert back to Date
    
        return cstDate.toISOString();
    }
});
