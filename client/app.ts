import { Client } from 'boardgame.io/client';
import { State } from 'boardgame.io';
import { SocketIO } from 'boardgame.io/multiplayer'
import { EmuBayRailwayCompany, IEmuBayState } from '../game/game';
import { Board } from './board';
import { Ui } from './ui';

import * as PIXI from 'pixi.js'

localStorage.debug = '*';

class EmuBayRailwayCompanyClient {
    private client: any;
    private rootElement: HTMLElement;
<<<<<<< HEAD
    constructor(rootElement: HTMLElement, mpAddress?: string, playerID?: string, matchId?: string, numPlayers: number = 4 ) {
=======
    constructor(rootElement: HTMLElement, mpAddress?: string, playerID?: string, matchId?: string, numPlayers: number = 4) {
>>>>>>> new_creds
        this.rootElement = rootElement;
        if (!mpAddress) {
            // Hotseat
            this.client = Client({ game: EmuBayRailwayCompany, numPlayers: numPlayers });
<<<<<<< HEAD
=======
            this.client.start();
            continueLoading();
>>>>>>> new_creds
        } else {
            // Have to get a credential each time due to boardgame.io's 'authenticate' not playing super nicely with
            // the session storage
            let req = new XMLHttpRequest();
<<<<<<< HEAD
            req.open("get", "/getCredentials");
            req.onreadystatechange = () => {
                if (req.readyState == 4 && req.status == 200) {
                    let credentials = req.responseText;
                    this.client = Client({ game: EmuBayRailwayCompany,
                        multiplayer: SocketIO({server: mpAddress}),
                        matchID: matchId,
                        playerID: playerID,
                        credentials: credentials});
                } 
=======
            req.open("get", "/get_credentials");
            req.onreadystatechange = () => {
                if (req.readyState == 4 && req.status == 200) {
                    let credentials = req.responseText;
                    this.client = Client({
                        game: EmuBayRailwayCompany,
                        multiplayer: SocketIO({ server: mpAddress }),
                        matchID: matchId,
                        playerID: playerID,
                        credentials: credentials
                    });
                    this.client.start();
                    continueLoading();
                }
>>>>>>> new_creds
                else if (req.readyState == 4 && req.status != 200) {
                    document.body.innerHTML = `Failed to get credentials (${req.status}) - ${req.responseText}`;
                }
            }
<<<<<<< HEAD
        }
        this.client.start();
=======
            req.send();
        }
>>>>>>> new_creds
    }

    public pixiApp = new PIXI.Application({ backgroundColor: 0xEEEEFF, width: 1000, height: 1000 });

    public startLoop(resources: { [index: string]: PIXI.LoaderResource }): void {
        let mapState: Board = new Board(this.pixiApp, resources);
        let theUi = new Ui()
        mapState.start();
        // Subscribe in this order, as UI may change things the board needs
        this.client.subscribe((state: State) => {
            if (state === null) return;
            theUi.update(state.G as IEmuBayState, state.ctx, this.client, mapState)
        });
        this.client.subscribe((state: State) => {
            if (state === null) return;
            mapState.drawMap(state.G as IEmuBayState, state.ctx);
        });
    }
}

const appElement: HTMLElement = document.getElementById('app')!;
const params = new URLSearchParams(window.location.search);
var app: EmuBayRailwayCompanyClient;
if (params.has("matchId") && params.has("playerId")) {
    // Multiplayer
<<<<<<< HEAD
    
    app = new EmuBayRailwayCompanyClient(appElement, `${window.location.host}`, params.get('playerId')!, params.get("matchId")!);
} else
{
    // Hotseat
    app = new EmuBayRailwayCompanyClient(appElement);
}

=======
>>>>>>> new_creds

    app = new EmuBayRailwayCompanyClient(appElement, `${window.location.host}`, params.get('playerId')!, params.get("matchId")!);
} else {
    // Hotseat
    app = new EmuBayRailwayCompanyClient(appElement);
}

function continueLoading() {
    const loader = PIXI.Loader.shared;
    Board.addResources(loader);


    loader.load((loader: PIXI.Loader, resources: Partial<Record<string, PIXI.LoaderResource>>) => {
        console.log("Resources loaded");
        Board.getTextures(loader.resources)
        app.startLoop(loader.resources);
    })
}

document.querySelector("#board")?.appendChild(app.pixiApp.view)