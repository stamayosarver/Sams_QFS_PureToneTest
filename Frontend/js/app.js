document.addEventListener('DOMContentLoaded', function() {
    // Predefined test frequencies (Hz), including 12000 Hz and 16000 Hz.
    // Low frequencies: auto ramp tests; High frequencies: fixed duration test.
    const testFrequencies = [125, 250, 1000, 2000, 3000, 4000, 8000, 12000, 16000];
    let currentIndex = 0;
    let currentGain = 0.1; // starting gain for low frequencies; high frequencies will use 0.5
    const gainStep = 0.05;
    const maxGain = 1.0;
    let intervalId = null;
    let autoNextTimeout = null;  // used in high frequency tests to stop the tone after 3 seconds
    let audioCtx = null;
    let oscillator = null;
    let gainNode = null;
    let testResults = [];
    let resultRecorded = false; // flag so we record each test result only once

    // UI references
    const startButton = document.getElementById('start-test-button');
    const heardButton = document.getElementById('heard-button');
    const nextButton = document.getElementById('next-frequency-button');
    const replayButton = document.getElementById('replay-tone-button');
    const currentFrequencyDisplay = document.getElementById('current-frequency');
    const currentVolumeDisplay = document.getElementById('current-volume');
    const resultsSection = document.getElementById('results');
    const resultsTableBody = document.querySelector('#results-table tbody');
    const downloadButton = document.getElementById('download-csv');
    const restartButton = document.getElementById('restart-test-button');

    // Initially hide the control buttons (I Couldn't Hear It, Next Frequency, Replay Tone)
    heardButton.style.display = "none";
    nextButton.style.display = "none";
    replayButton.style.display = "none";

    function updateDisplay() {
        currentFrequencyDisplay.textContent = testFrequencies[currentIndex];
        currentVolumeDisplay.textContent = currentGain.toFixed(2);
    }

    function startTone() {
        resultRecorded = false; // reset flag for current tone
        // Hide control buttons while tone is playing.
        heardButton.style.display = "none";
        nextButton.style.display = "none";
        replayButton.style.display = "none";

        // Clear any pending timeouts/intervals.
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (autoNextTimeout) {
            clearTimeout(autoNextTimeout);
            autoNextTimeout = null;
        }

        if (testFrequencies[currentIndex] < 1000) {
            // LOW FREQUENCY: auto ramp the gain.
            currentGain = 0.1;
            updateDisplay();
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            oscillator = audioCtx.createOscillator();
            gainNode = audioCtx.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(testFrequencies[currentIndex], audioCtx.currentTime);
            gainNode.gain.setValueAtTime(currentGain, audioCtx.currentTime);

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.start();

            intervalId = setInterval(() => {
                if (currentGain < maxGain) {
                    currentGain += gainStep;
                    if (currentGain > maxGain) currentGain = maxGain;
                    gainNode.gain.setValueAtTime(currentGain, audioCtx.currentTime);
                    updateDisplay();
                } else {
                    clearInterval(intervalId);
                    stopTone();
                    if (!resultRecorded) {
                        recordResult();
                        resultRecorded = true;
                    }
                    // Now show the control buttons for every test including the first
                    heardButton.style.display = "inline-block";
                    nextButton.style.display = "inline-block";
                    replayButton.style.display = "inline-block";
                }
            }, 200);
        } else {
            // HIGH FREQUENCY: fixed gain tone for a fixed duration.
            currentGain = 0.5;
            updateDisplay();
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            oscillator = audioCtx.createOscillator();
            gainNode = audioCtx.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(testFrequencies[currentIndex], audioCtx.currentTime);
            gainNode.gain.setValueAtTime(currentGain, audioCtx.currentTime);

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.start();

            // Let the tone play for 3 seconds then stop and show the control buttons.
            autoNextTimeout = setTimeout(() => {
                stopTone();
                // Always display the control buttons once the tone stops.
                heardButton.style.display = "inline-block";
                nextButton.style.display = "inline-block";
                replayButton.style.display = "inline-block";
            }, 3000);
        }
    }

    function stopTone() {
        if (oscillator) {
            try {
                oscillator.stop();
            } catch (e) { }
            oscillator.disconnect();
            oscillator = null;
        }
        if (gainNode) {
            gainNode.disconnect();
            gainNode = null;
        }
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (autoNextTimeout) {
            clearTimeout(autoNextTimeout);
            autoNextTimeout = null;
        }
        if (audioCtx) {
            audioCtx.close();
            audioCtx = null;
        }
    }

    function recordResult() {
        testResults.push({
            frequency: testFrequencies[currentIndex],
            gain: currentGain.toFixed(2)
        });
        const row = document.createElement('tr');
        row.innerHTML = `<td class="border px-4 py-2">${testFrequencies[currentIndex]}</td>
                         <td class="border px-4 py-2">${currentGain.toFixed(2)}</td>`;
        resultsTableBody.appendChild(row);
    }

    function recordFailure() {
        testResults.push({
            frequency: testFrequencies[currentIndex],
            gain: "Not Heard"
        });
        const row = document.createElement('tr');
        row.innerHTML = `<td class="border px-4 py-2">${testFrequencies[currentIndex]}</td>
                         <td class="border px-4 py-2">Not Heard</td>`;
        resultsTableBody.appendChild(row);
    }

    function moveToNextFrequency() {
        currentIndex++;
        if (currentIndex < testFrequencies.length) {
            // Set starting gain based on the next frequency.
            currentGain = testFrequencies[currentIndex] < 1000 ? 0.1 : 0.5;
            updateDisplay();
            // Hide control buttons before the next tone.
            heardButton.style.display = "none";
            nextButton.style.display = "none";
            replayButton.style.display = "none";
            startTone();
        } else {
            // End of test: all frequencies completed.
            localStorage.setItem("hearingResult", "16000");
            sendResultsToBackend();
            window.location.href = "completed.html";
        }
    }

    function sendResultsToBackend() {
        fetch('/api/results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: "samuel.tamayo-sarver@vanderbilt.edu", results: testResults })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Results stored:', data);
        })
        .catch(error => {
            console.error('Error storing results:', error);
        });
    }

    // Event listeners

    // Clicking the Start Test button initializes the first tone and then hides itself.
    startButton.addEventListener('click', () => {
        startButton.style.display = "none"; // remove Start Test button after initial test
        heardButton.disabled = false;
        currentIndex = 0;
        testResults = [];
        resultsTableBody.innerHTML = '';
        resultsSection.classList.add('hidden');
        currentGain = testFrequencies[currentIndex] < 1000 ? 0.1 : 0.5;
        updateDisplay();
        startTone();
    });

    // When the user clicks "I Couldn't Hear It":
    // stop the tone, record failure (if not already recorded),
    // store the current frequency as the hearing result,
    // and then redirect to the Questionnaire page.
    heardButton.addEventListener('click', () => {
        stopTone();
        if (!resultRecorded) {
            recordFailure();
            resultRecorded = true;
        }
        // Set hearing result equal to the test frequency at which the user clicked.
        localStorage.setItem("hearingResult", testFrequencies[currentIndex]);
        window.location.href = "questionaire.html";
    });

    // "Next Frequency" moves to the next tone (recording the result if not already recorded).
    nextButton.addEventListener('click', () => {
        stopTone();
        if (!resultRecorded) {
            recordResult();
            resultRecorded = true;
        }
        moveToNextFrequency();
    });

    // "Replay Tone" replays the current tone test.
    replayButton.addEventListener('click', () => {
        stopTone();
        currentGain = testFrequencies[currentIndex] < 1000 ? 0.1 : 0.5;
        updateDisplay();
        startTone();
    });

    downloadButton.addEventListener('click', () => {
        let csvContent = "data:text/csv;charset=utf-8,Frequency (Hz),Threshold (Gain)\n";
        testResults.forEach(row => {
            csvContent += `${row.frequency},${row.gain}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "audiometry_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    restartButton.addEventListener('click', () => {
        window.location.reload();
    });
}); 