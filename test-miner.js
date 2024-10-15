const argon2 = require('argon2');
const crypto = require('crypto');

// Simulate CryptoJS.SHA256
const CryptoJS = {
    SHA256: (message) => crypto.createHash('sha256').update(message).digest('hex')
};

// Global variables
let mining = false;
let account, memory_cost, difficulty, worker_id;
const stored_targets = ['XEN1', 'XUN'];

// Helper functions
function generate_random_sha256(max_length = 128) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    const random_string = Array.from({length: Math.floor(Math.random() * max_length) + 1}, () => characters[Math.floor(Math.random() * characters.length)]).join('');
    return CryptoJS.SHA256(random_string);
}

function is_within_five_minutes_of_hour() {
    const now = new Date();
    const minutes = now.getMinutes();
    return minutes < 5 || minutes >= 55;
}

async function mine_block() {
    let attempts = 0;
    const remove_prefix_address = account.slice(2);
    const salt = Buffer.from(remove_prefix_address, 'hex');

    while (mining) {
        attempts++;

        const random_data = generate_random_sha256();
        
        try {
            // Use argon2 to hash the random data
            const result = await argon2.hash(random_data, {
                salt: salt,
                timeCost: Math.max(2, difficulty),  // Ensure timeCost is at least 2
                memoryCost: memory_cost,
                parallelism: 1,
                type: argon2.argon2id,
                hashLength: 64
            });

            const hashed_data = result;
            const last_87_chars = hashed_data.slice(-87);

            // Check for target patterns in the hash
            for (const target of stored_targets) {
                if (last_87_chars.includes(target)) {
                    if (target === 'XUN' && /XUNI[0-9]/.test(hashed_data) && is_within_five_minutes_of_hour()) {
                        console.log({
                            type: 'XUN found',
                            hashed_data,
                            random_data,
                            attempts,
                            isSuperblock: false
                        });
                        continue;
                    } else if (target === 'XEN1') {
                        const last_element = hashed_data.split('$').pop();
                        const hash_uppercase_only = last_element.replace(/[^A-Z]/g, '');
                        const isSuperblock = hash_uppercase_only.length >= 50;
                        
                        console.log({
                            type: 'XEN1 found',
                            hashed_data,
                            random_data,
                            attempts,
                            isSuperblock
                        });
                        continue;
                    }
                }
            }
        } catch (error) {
            console.error({ type: 'error', message: error.toString() });
            mining = false;
            break;
        }

        // Update attempts
        if (attempts % 1000 === 0) {
            console.log({ type: 'update', attempts });
        }
    }
}

// Simulate starting the mining process
async function startMining(testAccount, testMemoryCost, testDifficulty, testWorkerId) {
    account = testAccount;
    memory_cost = testMemoryCost;
    difficulty = Math.max(2, testDifficulty);  // Ensure difficulty is at least 2
    worker_id = testWorkerId;
    mining = true;
    await mine_block();
}

// Run the test
startMining(
    "0x1234567890123456789012345678901234567890", // testAccount, valid ETH address (EIP-55)
    1024,  // Lower memory_cost value for faster testing
    2,     // Minimum allowed difficulty value
    "1"
);
