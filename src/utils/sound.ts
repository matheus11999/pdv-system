export const playSound = (src: string) => {
  try {
    const audio = new Audio(src);
    audio.play().catch(error => console.error('Error playing sound:', error));
  } catch (error) {
    console.error('Could not play sound:', error);
  }
};
