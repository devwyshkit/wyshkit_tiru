
import { getHomeDiscovery } from './src/lib/actions/discovery';
import { getServerLocation } from './src/lib/actions/location';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function test() {
    console.log('Testing getServerLocation...');
    try {
        const loc = await getServerLocation();
        console.log('Location success:', loc);
    } catch (e) {
        console.error('Location failed:', e);
    }

    console.log('\nTesting getHomeDiscovery...');
    try {
        // Default to Bangalore coords if needed
        const discovery = await getHomeDiscovery(12.9716, 77.5946);
        console.log('Discovery success (partial):', Object.keys(discovery));
    } catch (e) {
        console.error('Discovery failed:', e);
    }
}

test();
