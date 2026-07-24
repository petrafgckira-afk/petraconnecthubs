import ugandaUrl from '../assets/images/flags/Flag_of_Uganda.svg';
import kenyaUrl from '../assets/images/flags/Flag_of_Kenya.svg';
import usaUrl from '../assets/images/flags/Flag_of_United_States.svg';
import tanzaniaUrl from '../assets/images/flags/Flag_of_Tanzania.svg';
import egyptUrl from '../assets/images/flags/Flag_of_Egypt.svg';
import englandUrl from '../assets/images/flags/Flag_of_England.svg';
import chinaUrl from '../assets/images/flags/Flag_of_Peoples_Republic_of_China.svg';
import southAfricaUrl from '../assets/images/flags/Flag_of_South_Africa.svg';
import carUrl from '../assets/images/flags/Flag_of_Central_African_Republic.svg';
import uaeUrl from '../assets/images/flags/Flag_of_United_Arab_Emirates.svg';
import russiaUrl from '../assets/images/flags/Flag_of_Russia.svg';

const FLAGS = [
  { src: ugandaUrl,     label: 'Uganda' },
  { src: kenyaUrl,      label: 'Kenya' },
  { src: usaUrl,        label: 'United States' },
  { src: tanzaniaUrl,   label: 'Tanzania' },
  { src: egyptUrl,      label: 'Egypt' },
  { src: englandUrl,    label: 'England' },
  { src: chinaUrl,      label: 'China' },
  { src: southAfricaUrl,label: 'South Africa' },
  { src: carUrl,        label: 'Central African Republic' },
  { src: uaeUrl,        label: 'UAE' },
  { src: russiaUrl,     label: 'Russia' },
];

/* Duplicate for seamless loop */
const ITEMS = [...FLAGS, ...FLAGS];

export default function FlagStrip() {
  return (
    <div className="w-full overflow-hidden" style={{ background: 'transparent', padding: '4px 0' }}>
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          animation: 'flagMarquee 28s linear infinite',
        }}
      >
        {ITEMS.map((flag, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              marginRight: '40px',
              flexShrink: 0,
            }}
          >
            <img
              src={flag.src}
              alt={flag.label}
              style={{
                width: '52px',
                height: '34px',
                objectFit: 'cover',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
