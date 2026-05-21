import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonSearchbar, IonIcon, IonList, IonItem, IonLabel, IonNote } from '@ionic/react'
import { musicalNotes } from 'ionicons/icons'

const Search: React.FC = () => (
  <IonPage>
    <IonHeader translucent>
      <IonToolbar>
        <IonTitle>Search Songs</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent fullscreen className="ion-padding">
      <IonSearchbar placeholder="Search by artist or title..." animated disabled />

      <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <IonIcon icon={musicalNotes} style={{ fontSize: '4rem', color: 'var(--ion-color-step-400)', opacity: 0.5 }} />
        <p style={{ color: 'var(--ion-color-step-500)', marginTop: '1rem', fontSize: '0.95rem' }}>
          Song search will be available once you&apos;re connected to a venue.
        </p>
      </div>

      <IonList inset style={{ marginTop: '2rem', opacity: 0.4 }}>
        {['Don\'t Stop Believin\' — Journey', 'Bohemian Rhapsody — Queen', 'Sweet Caroline — Neil Diamond'].map((song) => (
          <IonItem key={song} disabled>
            <IonLabel>{song.split(' — ')[0]}</IonLabel>
            <IonNote slot="end">{song.split(' — ')[1]}</IonNote>
          </IonItem>
        ))}
      </IonList>
    </IonContent>
  </IonPage>
)

export default Search
