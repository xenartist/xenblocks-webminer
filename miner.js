// Global variables
let memory_cost = 1500; // Initial value, in KB
const difficulty = 1; // Fixed value for Argon2 time parameter
let account = '';
let worker_id = '1';
let mining = false;
let totalMiningTime = 0;
let miningStartTime;
let lastUpdateTime = 0;

let difficultyUpdateInterval;
let miningUpdateInterval;

let workers = [];
let workerCount = 1;
let workerHashes = {};
let workerSpeeds = {};

let TEST_MODE = false;

function populateWorkerOptions() {
    const maxWorkers = navigator.hardwareConcurrency || 4; 
    const select = document.getElementById('workerCount');
    
    select.appendChild(new Option("1", "1"));
    
    for (let i = 4; i <= maxWorkers; i += 4) {
        select.appendChild(new Option(i.toString(), i.toString()));
    }
}

function getTotalHashes() {
    return Object.values(workerHashes).reduce((sum, hash) => sum + hash, 0);
}

function getTotalSpeed() {
    return Object.values(workerSpeeds).reduce((sum, speed) => sum + speed, 0);
}

// Helper functions
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
}

async function updateMiningParameters() {
    const difficultyElement = document.getElementById('current-difficulty');
    if (difficultyElement) {
        difficultyElement.textContent = 'Fetching current difficulty...';
    }

    try {
        const response = await retryRequest(() => 
            fetch(`https://gist.githubusercontent.com/xenartist/a43d439c635c0278515a15c5e49b946b/raw/difficulty.json?_=${Date.now()}`)
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data && data.difficulty) {
            memory_cost = parseInt(data.difficulty);
            //JUST FOR TESTING
            if (TEST_MODE) {
                memory_cost = 8;
            }
            console.log(`Updated mining parameters: Difficulty=${memory_cost}`);
            
            if (difficultyElement) {
                difficultyElement.textContent = `Current Difficulty: ${memory_cost.toLocaleString()}`;
            }
        } else {
            throw new Error('Difficulty not found in the response');
        }
    } catch (error) {
        console.error('Error updating mining parameters:', error);
        if (difficultyElement) {
            difficultyElement.textContent = 'Error fetching difficulty';
        }
        throw error;
    }
}

function startMining() {
    const accountInput = document.getElementById('account');
    account = accountInput.value;
    if (!account || !validateEthereumAddress(account)) {
        alert('Please enter a valid Ethereum address. It should contain both uppercase and lowercase letters.');
        return;
    }
    
    if (!mining) {
        updateMiningParameters()
            .then(() => {
                mining = true;
                miningStartTime = performance.now();
                lastUpdateTime = miningStartTime;
                
                workerCount = parseInt(document.getElementById('workerCount').value);
                
                for (let i = 0; i < workerCount; i++) {
                    const worker = new Worker('mining-worker.js');
                    worker.onmessage = handleWorkerMessage;
                    worker.postMessage({
                        command: 'start',
                        account: account,
                        memory_cost: memory_cost,
                        difficulty: difficulty,
                        worker_id: `${i + 1}`
                    });
                    workers.push(worker);
                    workerHashes[`${i + 1}`] = 0;
                    workerSpeeds[`${i + 1}`] = 0;
                }
                
                difficultyUpdateInterval = setInterval(updateMiningParameters, 60000); // 1 minute
                miningUpdateInterval = setInterval(updateStatus, 1000);
                
                saveAccount();
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
        if (difficultyUpdateInterval) {
            clearInterval(difficultyUpdateInterval);
            difficultyUpdateInterval = null;
        }
        if (miningUpdateInterval) {
            clearInterval(miningUpdateInterval);
            miningUpdateInterval = null;
        }
        workers.forEach(worker => {
            worker.postMessage({ command: 'stop' });
            worker.terminate();
        });
        workers = [];
        workerHashes = {};
        workerSpeeds = {};
        updateStatus();
        document.getElementById('status').innerHTML += '<br>Mining stopped.';
    }
}

function handleWorkerMessage(e) {
    const { type, attempts, hashed_data, random_data, isSuperblock, worker_id } = e.data;
    const status_div = document.getElementById('status');

    if (type === 'update') {
        workerHashes[worker_id] = attempts;
        workerSpeeds[worker_id] = attempts / (performance.now() - miningStartTime) * 1000;
        updateStatus();
    } else if (type === 'found') {
        console.log(`Valid hash found by worker ${worker_id}!`);
        if (isSuperblock) {
            console.log('%cSuperblock found!', 'color: red; font-weight: bold;');
            status_div.innerHTML += '<br><span style="color: red; font-weight: bold;">Superblock found!</span>';
        }
        verifyAndSubmit(hashed_data, random_data, isSuperblock, worker_id);
    } else if (type === 'error') {
        console.error(`Worker ${worker_id} error:`, e.data.message);
        stopMining();
    }
}

function updateStatus() {
    const currentTime = performance.now();
    totalMiningTime = (currentTime - miningStartTime) / 1000;
    
    const totalHashes = getTotalHashes();
    const totalSpeed = getTotalSpeed();
    
    const status_div = document.getElementById('status');
    status_div.innerHTML = `Mining Hashes: ${formatNumber(totalHashes)}, Speed: ${totalSpeed.toFixed(2)} H/s, Total Mining Time: ${formatTime(Math.floor(totalMiningTime))}`;
    
    lastUpdateTime = currentTime;
}

async function verifyAndSubmit(hashed_data, random_data, isSuperblock, worker_id) {
    const status_div = document.getElementById('status');
    status_div.innerHTML += '<br>Verifying and submitting...';

    const payload = {
        hash_to_verify: hashed_data,
        key: random_data,
        account: account,
        attempts: getTotalHashes(),
        hashes_per_second: getTotalSpeed(),
        worker: worker_id
    };

    try {
        const response = await retryRequest(() => 
            fetch('https://server.xoon.dev/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            })
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Verification result:', result);

        if (result.success) {
            status_div.innerHTML += '<br>Hash verified successfully!';
            if (isSuperblock) {
                status_div.innerHTML += '<br><span style="color: red; font-weight: bold;">Superblock verified!</span>';
            }
            await submitProofOfWork(account, hashed_data, random_data);
        } else {
            status_div.innerHTML += '<br>Hash verification failed.';
        }
    } catch (error) {
        console.error('Error during verification:', error);
        status_div.innerHTML += '<br>Error occurred during verification. Check console for details.';
    }
}

async function submitProofOfWork(account, hash_to_verify, key) {
    const status_div = document.getElementById('status');
    status_div.innerHTML += '<br>Submitting Proof of Work...';

    try {
        const response = await retryRequest(() => 
            fetch('https://server.xoon.dev/lastblock')
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const records = await response.json();
        console.log('Records:', records);

        let verified_hashes = [];
        let output_block_id = 0;

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
            fetch('https://server.xoon.dev/send_pow', {
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

        status_div.innerHTML += '<br>Proof of Work submitted successfully!';
        return result;
    } catch (error) {
        console.error('Error submitting POW:', error);
        status_div.innerHTML += '<br>Error occurred during PoW submission. Check console for details.';
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

    return build(hashes)[0]; // Return only the root hash
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

function validateEthereumAddress(address) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return false;
    }
    if (!/[A-F]/.test(address) || !/[a-f]/.test(address)) {
        return false;
    }
    return true;
}

function saveAccount() {
    const accountInput = document.getElementById('account');
    localStorage.setItem('xenBlocksAccount', accountInput.value);
}

// Load saved account address if available
window.onload = function() {
    const savedAccount = localStorage.getItem('xenBlocksAccount');
    if (savedAccount) {
        document.getElementById('account').value = savedAccount;
    }
    populateWorkerOptions();
};

document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        console.log('Page hidden, continuing to mine in background');
    } else {
        console.log('Page visible, updating UI');
        updateStatus();
    }
});
