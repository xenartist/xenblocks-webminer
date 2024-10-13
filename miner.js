// Global variables
let memory_cost = 1500; // Initial value, in KB
const difficulty = 1; // Fixed value for Argon2 time parameter
let account = '';
const stored_targets = ['XEN11', 'XUNI'];
let mining = false;
let totalMiningTime = 0;
let miningStartTime;

let lastAttempts = 0;
let lastSpeed = 0;
let lastUpdateTime = 0;

// Helper functions
function hash_value(value) {
    return CryptoJS.SHA256(value).toString();
}

function generate_random_sha256(max_length = 128) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    const random_string = Array.from({length: Math.floor(Math.random() * max_length) + 1}, () => characters[Math.floor(Math.random() * characters.length)]).join('');
    return CryptoJS.SHA256(random_string).toString();
}

function is_within_five_minutes_of_hour() {
    const now = new Date();
    const minutes = now.getMinutes();
    return minutes < 5 || minutes >= 55;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
}

function updateMiningParameters() {
    const difficultyElement = document.getElementById('current-difficulty');
    if (difficultyElement) {
        difficultyElement.textContent = 'Fetching current difficulty...';
    }

    return new Promise((resolve, reject) => {
        const fetchPromise = fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('http://xenblocks.io/difficulty'))
            .then(response => response.json())
            .then(data => {
                if (data.contents) {
                    const difficulty = JSON.parse(data.contents).difficulty;
                    if (difficulty) {
                        memory_cost = parseInt(difficulty);
                    }
                    console.log(`Updated mining parameters: Difficulty=${memory_cost}`);
                    
                    // Update UI
                    if (difficultyElement) {
                        difficultyElement.textContent = `Current Difficulty: ${memory_cost.toLocaleString()}`;
                    }
                    resolve();
                } else {
                    throw new Error('Invalid response from server');
                }
            });

        const timeoutPromise = new Promise((_, timeoutReject) => {
            setTimeout(() => {
                timeoutReject(new Error('Difficulty fetch timed out'));
            }, 60000); // 60 second timeout
        });

        Promise.race([fetchPromise, timeoutPromise])
            .catch(error => {
                console.error('Error updating mining parameters:', error);
                
                // Update UI to show error
                if (difficultyElement) {
                    difficultyElement.textContent = 'Error fetching difficulty';
                }
                reject(error);
            });
    });
}

async function mine_block() {
    const status_div = document.getElementById('status');
    status_div.innerHTML = 'Mining...';

    let found_valid_hash = false;
    const remove_prefix_address = account.slice(2);
    const salt = CryptoJS.enc.Hex.parse(remove_prefix_address);

    let attempts = 0;
    const start_time = Date.now();
    lastUpdateTime = start_time;

    function updateAttempts() {
        status_div.innerHTML = `Mining Hashes: ${formatNumber(attempts)}${getSpeedAndTimeString()}`;
    }

    function getSpeedAndTimeString() {
        return `, Speed: ${lastSpeed.toFixed(2)} H/s, Total Mining Time: ${formatTime(totalMiningTime)}`;
    }

    function updateSpeedAndTime() {
        const current_time = Date.now();
        const elapsed_time = (current_time - lastUpdateTime) / 1000;
        
        const newAttempts = attempts - lastAttempts;
        lastSpeed = newAttempts / elapsed_time;
        lastAttempts = attempts;
        totalMiningTime += Math.floor(elapsed_time);
        lastUpdateTime = current_time;

        updateAttempts();
    }

    // Set up interval for updating speed and time every 5 seconds
    const updateInterval = setInterval(() => {
        if (mining) {
            updateSpeedAndTime();
        } else {
            clearInterval(updateInterval);
        }
    }, 5000);

    while (mining) {
        attempts++;
        updateAttempts();

        const random_data = generate_random_sha256();
        
        try {
            const result = await argon2.hash({
                pass: random_data,
                salt: salt.toString(),
                time: difficulty, // This remains constant
                mem: memory_cost, // This is updated periodically
                parallelism: 1,
                type: argon2.ArgonType.Argon2id,
                hashLen: 32
            });

            const hashed_data = result.hashHex;
            const last_87_chars = hashed_data.slice(-87);

            for (const target of stored_targets) {
                if (last_87_chars.includes(target)) {
                    if ((target === 'XUNI' && /XUNI[0-9]/.test(hashed_data) && is_within_five_minutes_of_hour()) || target === 'XEN11') {
                        found_valid_hash = true;
                        break;
                    }
                }
            }

            if (found_valid_hash) {
                updateSpeedAndTime(); // Update final status
                status_div.innerHTML += '<br>Valid hash found!';
                
                                // Prepare payload for verification
                                const payload = {
                                    hash_to_verify: hashed_data,
                                    key: random_data,
                                    account: account,
                                    attempts: attempts,
                                    hashes_per_second: lastSpeed,
                                    worker: worker_id // Ensure this is defined somewhere in your code
                                };
                
                                try {
                                    const response = await fetch('http://xenblocks.io/verify', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify(payload)
                                    });
                
                                    console.log("HTTP Status Code:", response.status);
                                    const responseData = await response.json();
                                    console.log("Server Response:", responseData);
                
                                    if (target === "XEN11" && response.status === 200) {
                                        // Call submit_pow
                                        const powResult = await submit_pow(account, random_data, hashed_data);
                                        if (powResult) {
                                            status_div.innerHTML += '<br>Proof of Work submitted successfully!';
                                        } else {
                                            status_div.innerHTML += '<br>Failed to submit Proof of Work.';
                                        }
                                    }
                                } catch (error) {
                                    console.error("An error occurred during verification:", error);
                                    status_div.innerHTML += '<br>Error occurred during verification. Check console for details.';
                                }
                
                mining = false;
                break;
            }
        } catch (error) {
            console.error('Argon2 hashing error:', error);
            status_div.innerHTML = 'Error occurred during mining. Check console for details.';
            mining = false;
            break;
        }

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    clearInterval(updateInterval);

    if (!mining) {
        status_div.innerHTML += '<br>Mining stopped.';
    }
}

async function submit_pow(account, key, hash_to_verify) {
    const last_block_url = 'http://xenminer.mooo.com:4445/getblocks/lastblock';
    const submit_url = 'http://xenblocks.io:4446/send_pow';

    try {
        // Fetch the last block record with retry
        const response = await retryRequest(() => fetch(last_block_url));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const records = await response.json();

        // Process the records
        const verified_hashes = [];
        let output_block_id;

        for (const record of records) {
            const { block_id, hash_to_verify: record_hash_to_verify, key: record_key, account: record_account } = record;

            // Verify the hash using Argon2
            if (await argon2.verify(record_hash_to_verify, record_key)) {
                verified_hashes.push(hash_value(block_id + record_hash_to_verify + record_key + record_account));
            }

            // Save the block_id from the last record
            output_block_id = Math.floor(block_id / 100);
        }

        // Build Merkle root
        const merkle_root = build_merkle_tree(verified_hashes);

        // Prepare payload for PoW
        const payload = {
            account_address: account,
            block_id: output_block_id,
            merkle_root,
            key,
            hash_to_verify
        };

        // Send POST request with retry
        const pow_response = await retryRequest(() => 
            fetch(submit_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            })
        );

        if (!pow_response.ok) {
            throw new Error(`HTTP error! status: ${pow_response.status}`);
        }

        const result = await pow_response.json();
        console.log('Proof of Work successful:', result);
        console.log(`Block ID: ${output_block_id}, Merkle Root: ${merkle_root}`);

        return result;
    } catch (error) {
        console.error('Error submitting POW:', error);
        return null;
    }
}

function build_merkle_tree(hashes) {
    let merkle_tree = {};

    function build(elements) {
        if (elements.length === 1) {
            return [elements[0], merkle_tree];
        }

        let new_elements = [];
        for (let i = 0; i < elements.length; i += 2) {
            let left = elements[i];
            let right = (i + 1 < elements.length) ? elements[i + 1] : left;
            let combined = left + right;
            let new_hash = hash_value(combined);
            merkle_tree[new_hash] = { left: left, right: right };
            new_elements.push(new_hash);
        }
        return build(new_elements);
    }

    return build(elements)[0]; // Return only the root hash
}

async function retryRequest(fn, maxRetries = 2, delay = 10000) {
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries) {
                throw error;
            }
            console.log(`Retrying... (${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function startMining() {
    const accountInput = document.getElementById('account');
    account = accountInput.value;
    if (!account) {
        alert('Please enter your Ethereum address');
        return;
    }
    
    if (!mining) {
        // First, update mining parameters and wait for it to complete
        updateMiningParameters()
            .then(() => {
                mining = true;
                miningStartTime = Date.now();
                lastAttempts = 0;
                lastSpeed = 0;
                lastUpdateTime = miningStartTime;
                
                // Start the periodic update
                setInterval(updateMiningParameters, 60000);
                
                // Save account
                saveAccount();
                
                // Start mining
                mine_block();
            })
            .catch(error => {
                console.error('Failed to start mining:', error);
                alert('Failed to fetch current difficulty. Please try again.');
            });
    } else {
        alert('Mining is already in progress.');
    }
}

function stopMining() {
    if (mining) {
        mining = false;
        totalMiningTime += Math.floor((Date.now() - lastUpdateTime) / 1000);
    }
}

// Load saved account address if available
window.onload = function() {
    const savedAccount = localStorage.getItem('xenBlocksAccount');
    if (savedAccount) {
        document.getElementById('account').value = savedAccount;
    }
};

// Save account address when mining starts
function saveAccount() {
    const accountInput = document.getElementById('account');
    localStorage.setItem('xenBlocksAccount', accountInput.value);
}
