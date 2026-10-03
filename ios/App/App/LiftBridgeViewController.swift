import Capacitor

class LiftBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WorkoutActivityPlugin())
    }
}
