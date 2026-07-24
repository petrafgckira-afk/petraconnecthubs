import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const SCRIPTURES = [
  {
    text: "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters, since you know that you will receive an inheritance from the Lord as a reward. It is the Lord Christ you are serving.",
    ref: "Colossians 3:23–24",
  },
  {
    text: "Commit to the Lord whatever you do, and he will establish your plans.",
    ref: "Proverbs 16:3",
  },
  {
    text: "The plans of the diligent lead to profit as surely as haste leads to poverty.",
    ref: "Proverbs 21:5",
  },
  {
    text: "Do you see someone skilled in their work? They will serve before kings; they will not serve before officials of low rank.",
    ref: "Proverbs 22:29",
  },
  {
    text: "Six days you shall labor and do all your work, but the seventh day is a sabbath to the Lord your God.",
    ref: "Exodus 20:9–10",
  },
  {
    text: "The one who is unwilling to work shall not eat.",
    ref: "2 Thessalonians 3:10",
  },
  {
    text: "All hard work brings a profit, but mere talk leads only to poverty.",
    ref: "Proverbs 14:23",
  },
  {
    text: "Whatever your hand finds to do, do it with all your might, for in the realm of the dead, where you are going, there is neither working nor planning nor knowledge nor wisdom.",
    ref: "Ecclesiastes 9:10",
  },
  {
    text: "She sets about her work vigorously; her arms are strong for her tasks. She sees that her trading is profitable, and her lamp does not go out at night.",
    ref: "Proverbs 31:17–18",
  },
  {
    text: "And we urge you, brothers and sisters, warn those who are idle and disruptive, encourage the disheartened, help the weak, be patient with everyone.",
    ref: "1 Thessalonians 5:14",
  },
  {
    text: "In all toil there is profit, but mere talk tends only to poverty.",
    ref: "Proverbs 14:23 (ESV)",
  },
  {
    text: "For even when we were with you, we gave you this rule: the one who is unwilling to work shall not eat. We hear that some among you are idle and disruptive. They are not busy; they are busybodies. Such people we command and urge in the Lord Jesus Christ to settle down and earn the food they eat.",
    ref: "2 Thessalonians 3:10–12",
  },
  {
    text: "The Lord God took the man and put him in the Garden of Eden to work it and take care of it.",
    ref: "Genesis 2:15",
  },
  {
    text: "Lazy hands make for poverty, but diligent hands bring wealth.",
    ref: "Proverbs 10:4",
  },
  {
    text: "Make it your ambition to lead a quiet life: you should mind your own business and work with your hands, just as we told you, so that your daily life may win the respect of outsiders and so that you will not be dependent on anybody.",
    ref: "1 Thessalonians 4:11–12",
  },
  {
    text: "Do not work for food that spoils, but for food that endures to eternal life, which the Son of Man will give you.",
    ref: "John 6:27",
  },
  {
    text: "And whatever you do, whether in word or deed, do it all in the name of the Lord Jesus, giving thanks to God the Father through him.",
    ref: "Colossians 3:17",
  },
  {
    text: "For we are God's handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do.",
    ref: "Ephesians 2:10",
  },
  {
    text: "The appetite of laborers works for them; their hunger drives them on.",
    ref: "Proverbs 16:26",
  },
  {
    text: "Therefore, my dear brothers and sisters, stand firm. Let nothing move you. Always give yourselves fully to the work of the Lord, because you know that your labor in the Lord is not in vain.",
    ref: "1 Corinthians 15:58",
  },
];

export default function ScriptureCarousel() {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * SCRIPTURES.length)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % SCRIPTURES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const scripture = SCRIPTURES[index];

  return (
    /* Fixed height sized to the longest scripture — layout never shifts */
    <div className="relative max-w-xl h-[210px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <p className="text-sm md:text-base leading-relaxed italic" style={{ color: '#F37021' }}>
            "{scripture.text}"
          </p>
          <p className="mt-3 text-xs font-mono tracking-widest" style={{ color: '#F37021' }}>
            — {scripture.ref}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
