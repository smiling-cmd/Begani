export function getGreeting(role = 'student') {
    const hour = new Date().getHours();

    let greeting;
    if (hour >= 4 && hour < 7) {
        greeting = 'Good early morning';
    } else if (hour >= 7 && hour < 12) {
        greeting = 'Good morning';
    } else if (hour >= 12 && hour < 16) {
        greeting = 'Good afternoon';
    } else if (hour >= 16 && hour < 24) {
        greeting = 'Good evening';
    } else {
        greeting = 'Late night, take care';
    }

    const isLateNight = hour < 4;
    const message = isLateNight
        ? role === 'therapist'
            ? 'Working late? Remember to take a moment for yourself, too.'
            : "Can't sleep? We've got a little something to help you unwind."
        : '';

    return { greeting, message, isLateNight };
}