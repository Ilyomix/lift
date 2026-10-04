// Protocol shim only: the production ContentState source is linked unchanged.
// This does not emulate WidgetKit rendering or ActivityKit scheduling.
public protocol ActivityAttributes: Codable {
    associatedtype ContentState: Codable, Hashable
}
